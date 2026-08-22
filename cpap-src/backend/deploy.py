"""Provision / update all AWS resources for the CPAP reminder backend.

Idempotent: safe to run repeatedly. Uses the 'cpap' AWS CLI profile.
Prints the API Function URL at the end (needed by the frontend build).
"""
import json
import sys
import time

import boto3
from botocore.exceptions import ClientError

REGION = "us-east-1"
TABLE = "cpap-data"
ROLE = "cpap-lambda-role"
API_FN = "cpap-api"
NOTIFIER_FN = "cpap-notifier"
RULE = "cpap-notifier-hourly"
GOOGLE_CLIENT_ID = "1045950533778-bn7kdf45a9un2a68s9p9j5e8cjfo40oo.apps.googleusercontent.com"
VAPID_PUBLIC_KEY = "BAnlDri51LvQuEqfGDF4baX_81kUQPFCRpPmv4JSQZPIwduYj5UyhGcO3o4hS5G9tV7gz8Gc8nFo9sfXyBZwmqw"
VAPID_SUBJECT = "mailto:brandonburtner@gmail.com"

with open("vapid_private.pem") as f:
    VAPID_PRIVATE_KEY = f.read()

session = boto3.Session(profile_name="cpap", region_name=REGION)
ddb = session.client("dynamodb")
iam = session.client("iam")
lam = session.client("lambda")
scheduler = session.client("scheduler")
sts = session.client("sts")
SCHED_ROLE = "cpap-scheduler-role"
ACCOUNT = sts.get_caller_identity()["Account"]

ENV = {
    "TABLE_NAME": TABLE,
    "GOOGLE_CLIENT_ID": GOOGLE_CLIENT_ID,
    "VAPID_PUBLIC_KEY": VAPID_PUBLIC_KEY,
    "VAPID_PRIVATE_KEY": VAPID_PRIVATE_KEY,
    "VAPID_SUBJECT": VAPID_SUBJECT,
}


def log(msg):
    print(f"[deploy] {msg}", flush=True)


# ---------------------------------------------------------------- DynamoDB
def ensure_table():
    try:
        ddb.describe_table(TableName=TABLE)
        log(f"table {TABLE} exists")
        return
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
    log(f"creating table {TABLE} ...")
    ddb.create_table(
        TableName=TABLE,
        AttributeDefinitions=[
            {"AttributeName": "pk", "AttributeType": "S"},
            {"AttributeName": "sk", "AttributeType": "S"},
        ],
        KeySchema=[
            {"AttributeName": "pk", "KeyType": "HASH"},
            {"AttributeName": "sk", "KeyType": "RANGE"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )
    ddb.get_waiter("table_exists").wait(TableName=TABLE)
    log("table active")


# ---------------------------------------------------------------- IAM role
def ensure_role():
    trust = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "lambda.amazonaws.com"},
            "Action": "sts:AssumeRole",
        }],
    }
    try:
        arn = iam.get_role(RoleName=ROLE)["Role"]["Arn"]
        log(f"role {ROLE} exists")
    except ClientError as e:
        if e.response["Error"]["Code"] != "NoSuchEntity":
            raise
        log(f"creating role {ROLE} ...")
        arn = iam.create_role(
            RoleName=ROLE,
            AssumeRolePolicyDocument=json.dumps(trust),
            Description="Execution role for CPAP reminder Lambdas",
        )["Role"]["Arn"]
        time.sleep(12)  # allow IAM to propagate before Lambda uses it

    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["logs:CreateLogGroup", "logs:CreateLogStream",
                           "logs:PutLogEvents"],
                "Resource": "arn:aws:logs:*:*:*",
            },
            {
                "Effect": "Allow",
                "Action": ["dynamodb:GetItem", "dynamodb:PutItem",
                           "dynamodb:UpdateItem", "dynamodb:DeleteItem",
                           "dynamodb:Query", "dynamodb:Scan",
                           "dynamodb:BatchWriteItem"],
                "Resource": [
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT}:table/{TABLE}",
                    f"arn:aws:dynamodb:{REGION}:{ACCOUNT}:table/{TABLE}/index/*",
                ],
            },
        ],
    }
    iam.put_role_policy(RoleName=ROLE, PolicyName="cpap-access",
                        PolicyDocument=json.dumps(policy))
    log("role policy set")
    return arn


# ---------------------------------------------------------------- Lambda
def ensure_function(name, handler, zip_path, timeout, memory, role_arn):
    with open(zip_path, "rb") as f:
        code = f.read()
    try:
        lam.get_function(FunctionName=name)
        exists = True
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            raise
        exists = False

    if exists:
        log(f"updating function {name} ...")
        lam.update_function_code(FunctionName=name, ZipFile=code)
        _wait_updated(name)
        lam.update_function_configuration(
            FunctionName=name, Handler=handler, Runtime="python3.12",
            Role=role_arn, Timeout=timeout, MemorySize=memory,
            Environment={"Variables": ENV},
        )
        _wait_updated(name)
    else:
        log(f"creating function {name} ...")
        for attempt in range(6):
            try:
                lam.create_function(
                    FunctionName=name, Runtime="python3.12", Role=role_arn,
                    Handler=handler, Code={"ZipFile": code},
                    Timeout=timeout, MemorySize=memory, Architectures=["x86_64"],
                    Environment={"Variables": ENV},
                )
                break
            except ClientError as e:
                # role not yet assumable -> retry
                if "cannot be assumed" in str(e) or "InvalidParameterValueException" in str(e):
                    log(f"  role not ready, retry {attempt+1}/6 ...")
                    time.sleep(8)
                    continue
                raise
        _wait_updated(name)
    return lam.get_function(FunctionName=name)["Configuration"]["FunctionArn"]


def _wait_updated(name):
    for _ in range(30):
        cfg = lam.get_function_configuration(FunctionName=name)
        if cfg.get("LastUpdateStatus") != "InProgress":
            return
        time.sleep(2)


# ---------------------------------------------------------------- Function URL
def ensure_function_url(name):
    try:
        url = lam.create_function_url_config(
            FunctionName=name, AuthType="NONE")["FunctionUrl"]
        log("created function URL")
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceConflictException":
            raise
        url = lam.get_function_url_config(FunctionName=name)["FunctionUrl"]
        log("function URL exists")
    # public invoke permission
    try:
        lam.add_permission(
            FunctionName=name, StatementId="FunctionURLAllowPublicAccess",
            Action="lambda:InvokeFunctionUrl", Principal="*",
            FunctionUrlAuthType="NONE",
        )
        log("added public invoke permission")
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceConflictException":
            raise
    return url


# ---------------------------------------------------------------- Schedule
def ensure_scheduler_role(notifier_arn):
    trust = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "scheduler.amazonaws.com"},
            "Action": "sts:AssumeRole",
        }],
    }
    try:
        arn = iam.get_role(RoleName=SCHED_ROLE)["Role"]["Arn"]
        log(f"role {SCHED_ROLE} exists")
    except ClientError as e:
        if e.response["Error"]["Code"] != "NoSuchEntity":
            raise
        log(f"creating role {SCHED_ROLE} ...")
        arn = iam.create_role(
            RoleName=SCHED_ROLE,
            AssumeRolePolicyDocument=json.dumps(trust),
            Description="Lets EventBridge Scheduler invoke the CPAP notifier",
        )["Role"]["Arn"]
        time.sleep(12)
    policy = {
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow", "Action": "lambda:InvokeFunction",
            "Resource": [notifier_arn, notifier_arn + ":*"],
        }],
    }
    iam.put_role_policy(RoleName=SCHED_ROLE, PolicyName="invoke-notifier",
                        PolicyDocument=json.dumps(policy))
    return arn


def ensure_schedule(notifier_arn):
    role_arn = ensure_scheduler_role(notifier_arn)
    params = dict(
        Name=RULE,
        ScheduleExpression="rate(1 hour)",
        FlexibleTimeWindow={"Mode": "OFF"},
        Target={"Arn": notifier_arn, "RoleArn": role_arn},
        State="ENABLED",
        Description="Hourly CPAP overdue-notification check",
    )
    for attempt in range(6):
        try:
            try:
                scheduler.create_schedule(**params)
                log("created hourly schedule")
            except ClientError as e:
                if e.response["Error"]["Code"] != "ConflictException":
                    raise
                scheduler.update_schedule(**params)
                log("updated hourly schedule")
            return
        except ClientError as e:
            # scheduler role may not be assumable yet
            if "ValidationException" in str(e) and "assume" in str(e).lower():
                log(f"  scheduler role not ready, retry {attempt+1}/6 ...")
                time.sleep(8)
                continue
            raise


def main():
    ensure_table()
    role_arn = ensure_role()
    api_arn = ensure_function(API_FN, "api_handler.handler", "api.zip",
                              30, 256, role_arn)
    notifier_arn = ensure_function(NOTIFIER_FN, "notifier_handler.handler",
                                   "notifier.zip", 120, 256, role_arn)
    url = ensure_function_url(API_FN)
    ensure_schedule(notifier_arn)
    log("DONE")
    print("\nAPI_FUNCTION_URL=" + url)


if __name__ == "__main__":
    sys.exit(main())
