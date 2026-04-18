export const config = {
  cognito: {
    domain: "us-east-2ecrfu9jqz.auth.us-east-2.amazoncognito.com",
    clientId: "41e3ge29dk4g3ebo2p124nu747",
    redirectUri: "https://brandonburtner.com/family-bank/callback",
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