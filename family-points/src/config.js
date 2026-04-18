export const config = {
  cognito: {
    domain: "us-east-2h4ntkowqk.auth.us-east-2.amazoncognito.com",
    clientId: "42t9o70vjlhfngnvf76e222abq",
    redirectUri: "https://brandonburtner.com/family-bank/",
    logoutUri: "https://brandonburtner.com/family-bank",
    scopes: "email openid profile"
  },
  api: {
    baseUrl: "https://nmwmbf63df.execute-api.us-east-2.amazonaws.com"
  },
  users: {
    kid: {
      email: "asherburtner@gmail.com",
      name: "Asher",
      userId: null  // Fill in after he logs in for the first time
    }
  }
}
