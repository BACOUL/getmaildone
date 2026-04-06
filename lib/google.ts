import { google } from "googleapis";

export function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  console.log("GOOGLE_CLIENT_ID exists:", Boolean(clientId));
  console.log("GOOGLE_CLIENT_SECRET exists:", Boolean(clientSecret));
  console.log("GOOGLE_REDIRECT_URI exists:", Boolean(redirectUri));

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      `Missing Google OAuth environment variables: GOOGLE_CLIENT_ID=${Boolean(
        clientId
      )}, GOOGLE_CLIENT_SECRET=${Boolean(
        clientSecret
      )}, GOOGLE_REDIRECT_URI=${Boolean(redirectUri)}`
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}
