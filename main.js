const {app, BrowserWindow, ipcMain, session} = require('electron')
const url = require('url');
const http = require('http')
const {OAuth2Client} = require('google-auth-library')
const querystring = require('querystring')


const whiteListedUrls = ["https://accounts.google.com"]

let win, authWindow

function createWindow(options){
    // Create a window
    var window = new BrowserWindow(options);
    return window
}

function clearStorage(arg){
    session.defaultSession.clearStorageData()
}

function openAuthWindow(authorizeURL){
    authWindow = createWindow({
        width: 600,
        height: 600,
        autoHideMenuBar: true,
        webPreferences:{
            nodeIntegration: false
        }
    });
    authWindow.loadURL(authorizeURL)
    authWindow.setMenu(null)
    authWindow.on('closed', ()=>{authWindow = null})
    authWindow.webContents.openDevTools()       
}

function closeAuthWindow(){
    if (authWindow){
        authWindow.close();
        authWindow = null
    }
}

//Start by acquiring a pre-authenticated oAuth2 client.
async function authorizeClient(){
    try{
        const oAuth2Client = await getAuthenticatedClient();
        console.log("Waiting on window")
        // request to google 
        const url = 'https://www.googleapis.com/plus/v1/people?query=pizza'
        const res = await oAuth2Client.request({url})
        console.log(res.data);
        return oAuth2Client;
    } catch (e){
        console.log(e)
    }
}

function getAuthenticatedClient(){
    return new Promise((resolve, reject)=>{
        // oAuth client to authorize the api call
        const oAuth2Client = new OAuth2Client({
            clientId: '65786425587-lvo40a1ujqao6umjn7cdi11n1epetmok.apps.googleusercontent.com',
            redirectUri: 'http://localhost:3000/oauth2callback',
            hosted_domain: 'isss.ca'
        });

        // Generate the url that will be used
        const authorizeURL = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: 'email,https://www.googleapis.com/auth/plus.me'
        });

        // Open http server to accept oauth callback
        const server = http.createServer(async(req, res) => {
            if (req.url.indexOf('/oauth2callback') > -1){
                // accquire code from querystring, close the webserver
                const qs = querystring.parse(url.parse(req.url).query)
                console.log(`Code is ${qs.code}`)
                res.end("Authentication successful! Please close this window");
                server.close()
                closeAuthWindow()

                // We have the code, use that to acquire tokens.
                const r = await oAuth2Client.getToken(qs.code)
                // Set credentials on oAuth2Client
                oAuth2Client.setCredentials(r.tokens)
                console.info('Tokens acquired.')
                resolve(oAuth2Client)
            }
        }).listen(3000, ()=>{
            console.log(authorizeURL)
            openAuthWindow(authorizeURL)
        })

    })
}


//---- EVENTS ----//
// IPC Events
ipcMain.on('wipe-session-data',(event, arg)=>{
    clearStorage(arg); console.log("[main.js]: Cleared session data!")
})

// To do. close all un-authorized windows
app.on('browser-window-created', (event, window)=>{
    console.log('[main.js]: New_Window: ' +window.getTitle() + ' was created')
})

function main(){
    // Main Window
    win = createWindow({
        width: 450,
        height: 450,
        frame: true, resizable:false, backgroundColor: "#2e2c29",
        autoHideMenuBar: true,
        webPreferences:{
            nodeIntegration: true
        }
    });
    win.setMenu(null)
    win.on('closed', ()=>{
        win = null
        if (authWindow){
            closeAuthWindow()
        }
    })
    win.loadFile('index.html')
    win.webContents.openDevTools()   

    const oAuth2Client = authorizeClient()
    console.log("Done main")
}


// -- START -- //
app.on('ready', ()=>{
    main();
})