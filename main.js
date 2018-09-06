const {app, BrowserWindow, ipcMain} = require('electron')
const url = require('url');
  
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  let win, auth_window
  
  function createWindow () {
    // Create the browser window.
    win = new BrowserWindow({width: 800, height: 600})
  
    // and load the index.html of the app.
    win.loadFile('index.html')
  
    // Open the DevTools.
    win.webContents.openDevTools()
  
    // Emitted when the window is closed.
    win.on('closed', () => {
      win = null
    })
  }
  
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  
  
  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
  
  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow()
    }
  })
  
  // In this file you can include the rest of your app's specific main process
  // code. You can also put them in separate files and require them here.
// require("./lib/googleLogin.js")

// ipcMain.on('open-auth-window', (event, authorizeUrl) =>{
function openAuthWindow(authorizeUrl){
    auth_window = new BrowserWindow({width: 800, height: 600})
    auth_window.loadURL(authorizeUrl)
    auth_window.on('closed', () => {
        auth_window = null
    })
}


// ipcMain.on('close-auth-window', (event, arg) => {
function closeAuthWindow(){
    if (auth_window){
        auth_window.close();
        auth_window = null;
    }
}

    const {OAuth2Client} = require('google-auth-library');
    const http = require('http');
    
    const querystring = require('querystring');

    // Download your OAuth2 configuration from the Google
    // const keys = require('./keys.json');

    /**
     * Start by acquiring a pre-authenticated oAuth2 client.
     */
    async function authorizeClient() {
    try {
        const oAuth2Client = await getAuthenticatedClient();
        // Make a simple request to the Google Plus API using our pre-authenticated client. The `request()` method
        // takes an AxiosRequestConfig object.  Visit https://github.com/axios/axios#request-config.
        const url = 'https://www.googleapis.com/plus/v1/people?query=pizza';
        const res = await oAuth2Client.request({url})
        console.log(res.data);
    } catch (e) {
            console.log(e);
    }
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
            closeAuthWindow()

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
            openAuthWindow(authorizeUrl)

        });
    });
    }

app.on('ready', ()=>{
    createWindow();
    authorizeClient();
})


const sqlite3 = require("sqlite3")