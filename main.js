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
        // console.log("Waiting on window")
        // request to google 
        // const url = 'https://www.googleapis.com/oauth2/v2/userinfo'
        // const res = await oAuth2Client.request({url})
        // console.log(res.data);
        // console.log(oAuth2Client);
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
        });

        // Generate the url that will be used
        const authorizeURL = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/plus.me https://www.googleapis.com/auth/userinfo.profile',
            hd: 'isss.ca'
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

ipcMain.on('prompt-login', (event, arg)=>{
    authorizeClient().then((oAuth2Client)=>{
        const url = 'https://www.googleapis.com/oauth2/v2/userinfo?fields=email%2Cfamily_name%2Cgender%2Cgiven_name%2Chd%2Cid%2Clink%2Clocale%2Cname%2Cpicture'
        const res = oAuth2Client.request({url})

        res.then((result) =>{
            const usr = result.data
            if (usr.hd === "isss.ca"){
                event.sender.send("logged-in", {email: usr.email, name: usr.name, img: usr.picture})
            } else {
                console.log("Failed to log in")
                event.sender.send("login-failed", {errCode: 0, msg:"Invalid email. Please use '@isss.ca'"})
            }
            
        })       
        
    }).catch((err)=>{
        console.log("[main.js] Error: ", err)
        console.log("Failed to log in")
        event.sender.send("login-failed", {errCode: 1, msg:"Failed to authorize client"})
    })

    
})

ipcMain.on('ping',()=>{
    console.log("PONG")
})
// To do. close all un-authorized windows
app.on('browser-window-created', (event, window)=>{
    console.log('[main.js]: New_Window: ' +window.getTitle() + ' was created')
})


//---- MAIN FUNCTION ----//

function main(){
    // Main Window
    win = createWindow({
        width: 450,
        height: 500,
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

    // const oAuth2Client = authorizeClient()
    console.log("Done main")
}


// -- START -- //
app.on('ready', ()=>{
    main();
})