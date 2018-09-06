const {ipcRenderer} = require('electron')
const {OAuth2Client} = require('google-auth-library');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const opn = require('opn');

// Download your OAuth2 configuration from the Google
// const keys = require('./keys.json');

/**
 * Start by acquiring a pre-authenticated oAuth2 client.
 */
async function main() {
  try {
    const oAuth2Client = await getAuthenticatedClient();
    // Make a simple request to the Google Plus API using our pre-authenticated client. The `request()` method
    // takes an AxiosRequestConfig object.  Visit https://github.com/axios/axios#request-config.
    const url = 'https://www.googleapis.com/plus/v1/people?query=pizza';
    const res = await oAuth2Client.request({url})
    console.log(res.data);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
console.log("IPC RENDERER: " + ipcRenderer)
function test(){
  console.log("test from gljs")
  console.log(ipcRenderer)
}


/**
 * Create a new OAuth2Client, and go through the OAuth2 content
 * workflow.  Return the full client to the callback.
 */
function getAuthenticatedClient() {
  return new Promise((resolve, reject) => {
    // create an oAuth client to authorize the API call.  Secrets are kept in a `keys.json` file,
    // which should be downloaded from the Google Developers Console.
    const oAuth2Client = new OAuth2Client({
      clientId: "65786425587-lvo40a1ujqao6umjn7cdi11n1epetmok.apps.googleusercontent.com",
      redirectUri: 'http://localhost:3000/oauth2callback'
    });

    // Generate the url that will be used for the consent dialog.
    const authorizeUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: 'https://www.googleapis.com/auth/plus.me'
    });

    // Open an http server to accept the oauth callback. In this simple example, the
    // only request to our webserver is to /oauth2callback?code=<code>
    const server = http.createServer(async (req, res) => {
      if (req.url.indexOf('/oauth2callback') > -1) {
        // acquire the code from the querystring, and close the web server.
        const qs = querystring.parse(url.parse(req.url).query);
        console.log(`Code is ${qs.code}`);
        res.end('Authentication successful! Please return to the console.');
        server.close();
        ipcRenderer.send('close-auth-window')

        // Now that we have the code, use that to acquire tokens.
        const r = await oAuth2Client.getToken(qs.code)
        // Make sure to set the credentials on the OAuth2 client.
        oAuth2Client.setCredentials(r.tokens);
        console.info('Tokens acquired.');
        resolve(oAuth2Client);
      }
    }).listen(3000, () => {
      console.log(authorizeUrl)
      // open the browser to the authorize url to start the workflow
      // opn(authorizeUrl);
      // console.log(ipcRenderer)
      // ipcRenderer.send('open-auth-window', authorizeUrl)
      test()

    });
  });
}

main();