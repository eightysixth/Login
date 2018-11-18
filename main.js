const {app, BrowserWindow, ipcMain, session, Menu, Tray, Notification, dialog, nativeImage} = require('electron')
const path = require('path')
const url = require('url');
const http = require('http');
const fs = require('fs')
const requests = require('request')
const {OAuth2Client} = require('google-auth-library')
const querystring = require('querystring')
const Datastore = require('nedb') 

const usersGist = "c89882a752672115a0751ad901f29e98"
const appData = path.join(app.getPath('appData') , '/ISSS_Login_App')

// Create our app's folder if not exists
if (!fs.existsSync(appData)){
    fs.mkdirSync(appData);
}
const loginDBFile = path.join(appData, "logins.db")
if (!fs.existsSync(loginDBFile)){
    console.log("File doesn't exist")
    fs.writeFileSync(loginDBFile)
}
console.log("Db file: ", loginDBFile)


const usersFile = path.join(appData, "users.json")
var loginsDb = new Datastore({filename: loginDBFile,
    autoload: true,})
var usersDb = new Datastore({inMemoryOnly: true})

let win, authWindow, server, userInfo, scheduleWin, curUser

// Locate the event log file.
// fs.openSync("./data/config.json")
function loadRawGist(gistID, fileName){
    // Return new promise
    return new Promise(function(resolve, reject){
        const gistURL = "https://api.github.com/gists/" + gistID
        requests(gistURL, {headers :{'User-Agent': 'request'}}, (err, res, body)=>{
            if (err) {reject(err)}
            const data = JSON.parse(body)
            // console.log(body)
            requests(data.files[fileName].raw_url, {headers:{"User-Agent": 'request'}}, (err, res, body)=>{
                if (err){return console.log(err)}
                // console.log(body)
                if (fileName != null){
                    fs.writeFileSync(usersFile, body, {encoding:'utf8', flag:'w'})
                }
                resolve(body)
            })
        })
    })
}

function loadUsersDB(usersDb,userInfo){
    for (var i = 0; i < userInfo.length; i++){
        var curUser = userInfo[i]
        var usrType = "usr"
        // Check if user is admin or not.
        if (curUser[4] != null && curUser[4] == 'admin'){
            usrType = 'admin'
        }
        var dbData = {_id: curUser[3], type:usrType, position: curUser[1],name: curUser[2], isss_email: curUser[0]}
        usersDb.insert(dbData)
        console.log(dbData)
    }
}

loadRawGist(usersGist, 'users.json').then(function(data){
    userInfo = JSON.parse(data)
    loadUsersDB(usersDb, userInfo)
}).catch((reason)=>{
    console.log(reason)
    // Load data from the cached file
    console.log("Loading from cache")
    fs.readFile('./data/users.json', (err, data)=>{
        if (err){console.log("Failed to load data")}
        else{userInfo = JSON.parse(data)}
    })
    loadUsersDB(usersDb, userInfo)
}).then(()=>{loadUsersDB(usersDb, userInfo)})


function createWindow(options){
    // Create a window
    var window = new BrowserWindow(options);
    return window
}

function clearStorage(arg){
    // session.defaultSession.clearStorageData()
    console.log("[main.js]: Cleared session data!")
}

function openAuthWindow(authorizeURL, oAuth2Client){
    authWindow = createWindow({
        width: 600,
        height: 600,
        autoHideMenuBar: true,
        webPreferences:{
            nodeIntegration: false
        },
        frame: true,
        parent: win,
    });
    authWindow.loadURL(authorizeURL)
    authWindow.setMenu(null)
    authWindow.on('closed', ()=>{authWindow = null})
    // authWindow.webContents.openDevTools()    
    console.log(oAuth2Client)   

    authWindow.on('close',()=>{
        if (server != null){
            server.close();
            server = null;
        }
    })
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
        return oAuth2Client;
    } catch (e){
        console.log(e)
    }
}

function getAuthenticatedClient(){
    return new Promise((resolve, reject)=>{
        // oAuth client to authorize the api call
        const oAuth2Client = new OAuth2Client({
            clientId: '704301194158-1p4l16mqml07pk1gn08dt11cmv570t1k.apps.googleusercontent.com',
            redirectUri: 'http://localhost:3000/oauth2callback',
        });

        // Generate the url that will be used
        const authorizeURL = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/plus.me https://www.googleapis.com/auth/userinfo.profile',
            hd: 'ualberta.ca'
        });

        // Open http server to accept oauth callback
        server = http.createServer(async(req, res) => {
            if (req.url.indexOf('/oauth2callback') > -1){
                // accquire code from querystring, close the webserver
                const qs = querystring.parse(url.parse(req.url).query)
                // console.log(`Code is ${qs.code}`)
                res.end("Authentication successful! Please close this window");
                server.close();
                server = null;
                closeAuthWindow()

                // We have the code, use that to acquire tokens.
                const r = await oAuth2Client.getToken(qs.code)
                // Set credentials on oAuth2Client
                oAuth2Client.setCredentials(r.tokens)
                console.info('Tokens acquired.')

                // Everything is done. No need for server to stay up
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
    clearStorage(arg); 
})

ipcMain.on('prompt-login', (event, arg)=>{
    if (authWindow != null){
        authWindow.focus()
        return;
    } else {
        authorizeClient().then((oAuth2Client)=>{
            const url = 'https://www.googleapis.com/oauth2/v2/userinfo?fields=email%2Cfamily_name%2Cgender%2Cgiven_name%2Chd%2Cid%2Clink%2Clocale%2Cname%2Cpicture'
            const res = oAuth2Client.request({url})

            res.then((result) =>{
                const usr = result.data
                // Make sure user isn't logging in from unauthorized org.
                // console.log("User logged in with HD: ", usr.hd)
                if (usr.hd === "isss.ca" || usr.hd === "ualberta.ca"){
                    
                    var isMember = false;
                    // Make sure user is valid.
                    usersDb.find({_id:usr.email}, function(err, docs){
                        if (docs.length == 0){
                            // No such user found
                            event.sender.send("login-failed", {errCode: "non-registered", msg:"Logged in, but you're not a registered user"})
                            loginsDb.insert({createdAt: Date(), type:'failed-login', email: usr.email})
                        } else {
                            // Check if user type is admin.
                            if (docs[0].type == 'admin'){
                                // Send command to open admin window.
                                adminPrompt({img: usr.picture, name: usr.name, email: usr.email})
                            }
                            console.log("THIS IS DOCS: ", docs)
                            event.sender.send("logged-in", {email: usr.email, name: usr.name, img: usr.picture})
                            loginsDb.insert({createdAt: Date(), type:'login', email: usr.email})                            
                        }
                    })
                    if (!isMember){
                        loginsDb.insert({createdAt: Date(), type:'non-registered'})                             
                    }
                } else {
                    console.log("Failed to log in")
                    event.sender.send("login-failed", {errCode: "invalid-email", msg:"Login failed. Please use your '@ualberta.ca' email"})
                    loginsDb.insert({createdAt: Date(), type:'failed-login', email: usr.email})
                }
            })       
        }).catch((err)=>{
            console.log("[main.js] Error: ", err)
            console.log("Failed to log in")
            event.sender.send("login-failed", {errCode: 1, msg:"Failed to authorize client"})
        })
    }   
})



ipcMain.on('ping',()=>{
    console.log("PONG")
})

ipcMain.on('show-schedule', ()=>{
    if (scheduleWin){
        scheduleWin.show()
        scheduleWin.focus()
    }
})

function closeChildWindows(parent){
    parent.getChildWindows().forEach((child)=>{
        child.close();
    })
}
// To do. close all un-authorized windows
app.on('browser-window-created', (event, window)=>{
    console.log('[main.js]: New_Window: ' +window.getTitle() + ' was created')
})

//---- OTHER FUNCTIONS ----//
function createScheduleWindow(){
    scheduleWin = createWindow({
        title: "ISSS",
        width: 1032,
        height: 494,
        frame: true, resizable:false,
        autoHideMenuBar: true,
        show:false,
        parent: win,
    })
    scheduleWin.setMenu(null)
    scheduleWin.loadFile('schedule.html')
    scheduleWin.on('close', function(event){
        if (!app.isQuitting){
            event.preventDefault();
            scheduleWin.hide();
        };
    })
}

function createAdminWindow(usrEmail){
    adminWin = createWindow({
        title: "ISSS",
        width: 1032,
        height: 494,
        frame: true, resizable:false,
        autoHideMenuBar: true,
        parent: win,
    })
    adminWin.setMenu(null)
    adminWin.loadFile('panel.html')

    // Log usr opened Admin console
    loginsDb.insert({createdAt: Date(), type:'panel-open',email:usrEmail})
    adminWin.on('close', function (event){
        loginsDb.insert({createdAt: Date(), type:'panel-close',email:usrEmail})
    })
    return adminWin
}

function adminPrompt(usr){
    // console.log("Prompt admin for: ", usr)
    prompt = dialog.showMessageBox({
        type: "question",
        buttons: ["Yes", "No"],
        defaultId: 0,
        message: usr.name + ", would you like to open the Admin panel?",
    })
    console.log("USER RESPONDED!, Response is ", prompt)
    if (prompt == 0){
        // Open admin panel
        createAdminWindow(usr.email);
    }
}

//---- MAIN FUNCTION ----//

function main(){
    // Main Window
    const iconPath = path.join(__dirname, "/public/img/icon.png")
    win = createWindow({
        title: "ISSS",
        width: 450,
        height: 500,
        frame: true, resizable:false, backgroundColor: "#2e2c29",
        icon: iconPath,
        autoHideMenuBar: true,
        webPreferences:{
            nodeIntegration: true
        }
    });
    win.setMenu(null)
    win.on('close', (event)=>{
        if(!app.isQuitting){
            event.preventDefault()
            win.hide()
            // Close all open child windows
            closeChildWindows(win)
            // closeAuthWindow()
        } else {
            win = null
            closeChildWindows(win)
            // closeAuthWindow()
        }
        return false;       
    })
    win.loadFile('index.html')
    // win.webContents.openDevTools()   
    
    // System Tray
    appIcon = new Tray(iconPath)
    var contextMenu = Menu.buildFromTemplate([
        {label: "Show App", click: function(){
            win.show();
        }},
        {label: "Quit", click: function(){
            app.isQuitting = true;
            app.quit()
        }}
    ])
    appIcon.setContextMenu(contextMenu)
    appIcon.on('click', function(){
        win.show()
    })
    appIcon.setToolTip("ISSS Login")
    
    createScheduleWindow()
    clearStorage()
    // const oAuth2Client = authorizeClient()
    console.log("Done main")
}

// Only one instance of the app can be running at once
var shouldQuit = app.makeSingleInstance(function(commandLine, workingDirectory){
    if (win){
        if (win.isMinimized()) {win.restore()}
        win.show();
        win.focus();
    }
})

if (shouldQuit){
    app.quit();
    return;
}

// -- START -- //
app.on('ready', ()=>{
    main();
})