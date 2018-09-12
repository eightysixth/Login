const {ipcRenderer} = require("electron")

function promptLogIn(){
    ipcRenderer.send('prompt-login')
}

ipcRenderer.on("logged-in", (event, arg) =>{
    // Arg will be user's data
    console.log(arg)
})

ipcRenderer.on('login-failed', (event, arg)=>{
    console.log('loginfailed', arg)
    if (arg.errCode != null){
        console.log(arg.msg)
    }
})