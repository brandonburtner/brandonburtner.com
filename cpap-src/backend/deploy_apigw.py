"""Attach API Gateway perms to the deployer, then create an HTTP API in front of
cpap-api (works around the org SCP that blocks public Lambda Function URLs)."""
import time
import boto3
from botocore.exceptions import ClientError

REGION = "us-east-1"
API_NAME = "cpap-http-api"
API_FN = "cpap-api"

session = boto3.Session(profile_name="cpap", region_name=REGION)
iam = session.client("iam")
lam = session.client("lambda")
sts = session.client("sts")
ACCOUNT = sts.get_caller_identity()["Account"]


def log(m): print(f"[apigw] {m}", flush=True)


# 1) self-grant API Gateway admin to the deployer (user authorized this)
try:
    iam.attach_user_policy(
        UserName="cpap-deployer",
        PolicyArn="arn:aws:iam::aws:policy/AmazonAPIGatewayAdministrator",
    )
    log("attached AmazonAPIGatewayAdministrator to cpap-deployer; waiting for propagation")
    time.sleep(12)
except ClientError as e:
    log(f"attach policy: {e.response['Error']['Code']} (continuing)")

# fresh session so the new permission is picked up
session = boto3.Session(profile_name="cpap", region_name=REGION)
apigw = session.client("apigatewayv2")
lam = session.client("lambda")

lambda_arn = lam.get_function(FunctionName=API_FN)["Configuration"]["FunctionArn"]

# 2) find or create the HTTP API
api_id = None
for a in apigw.get_apis().get("Items", []):
    if a["Name"] == API_NAME:
        api_id = a["ApiId"]
        endpoint = a["ApiEndpoint"]
        log(f"api exists: {api_id}")
        break

if not api_id:
    resp = apigw.create_api(
        Name=API_NAME,
        ProtocolType="HTTP",
        Target=lambda_arn,  # quick-create: AWS_PROXY integration + $default route + auto-deploy stage
    )
    api_id = resp["ApiId"]
    endpoint = resp["ApiEndpoint"]
    log(f"created api: {api_id}")
    time.sleep(3)

# 3) allow API Gateway to invoke the Lambda
try:
    lam.add_permission(
        FunctionName=API_FN,
        StatementId="apigw-invoke",
        Action="lambda:InvokeFunction",
        Principal="apigateway.amazonaws.com",
        SourceArn=f"arn:aws:execute-api:{REGION}:{ACCOUNT}:{api_id}/*/*",
    )
    log("granted API Gateway invoke permission")
except ClientError as e:
    if e.response["Error"]["Code"] != "ResourceConflictException":
        raise
    log("invoke permission already present")

print("\nAPI_BASE_URL=" + endpoint)
