
const express = require("express");
const http = require("http");
const socketio = require("socket.io");
const bonescript = require('bonescript');
const si = require('systeminformation');

const port = 5555;
const app = express();
const server = http.createServer(app).listen(port, () => console.log(`Listening on port ${port}`));
const io = socketio(server);

// Bone: AIN -> P9_39: A0    P9_40: A1    P9_37: A2    P9_38: A3    P9_33: A4    P9_36: A5     P9_35: A6
const inAnalogA3 = "A3";
const inAnalogA4 = "A4";
const inAnalogA5 = "A5";
const inAnalogA6 = "A6";

let interval;

io.on("connection", (socket) => {
    console.log(`Client connected  -  IP ${socket.request.connection.remoteAddress.split(":")[3]}  -  Client(s) ${io.engine.clientsCount}`);

    if(interval) clearInterval(interval);
    
    getStaticSystemData();
    
    interval = setInterval(() => {
        getDynamicSystemData();
        getSensorData();
    }, 1000);
    
    socket.on("disconnect", () => {
        console.log(`Client disconnected  -  IP ${socket.request.connection.remoteAddress.split(":")[3]}  -  Client(s) ${io.engine.clientsCount}`);
        if(io.engine.clientsCount === 0) clearInterval(interval);
    });
});


const getStaticSystemData = async () => {
    try {
        let [osInfo, network, networkGateway] = await Promise.all([si.osInfo(), si.networkInterfaces(), si.networkGatewayDefault()]);
        network = network.filter(obj => {return obj.type === 'wireless'})[0];

        const staticSystemData = {};

        staticSystemData.osInfo = {
            distro: `${osInfo.distro.slice(0,6)} ${osInfo.release} - ${osInfo.codename.charAt(0).toUpperCase() + osInfo.codename.slice(1)}`,
            kernel: osInfo.kernel,
            arch: osInfo.arch,
            serial: osInfo.serial
        };

        staticSystemData.network = {
            ip4: network.ip4,
            gateway: networkGateway,
            type: network.type,
            iface: network.iface
        }
        
        io.emit('socketStaticSystemData', staticSystemData);
        //console.log(staticSystemData);
    }
    catch(e){
        console.log(e);
    }
};


const getDynamicSystemData = async () => {
    try {
        let [time, cpu, memoryRAM, memoryDisk] = await Promise.all([si.time(), si.currentLoad(), si.mem(), si.fsSize()]);
        memoryDisk = memoryDisk[0];
        
        const dynamicSystemData = {};

        dynamicSystemData.time = {
            currentTime: new Date().toString().slice(0,24),
            uptime: new Date(time.uptime*1000).toISOString().substr(11, 8),
            timezone: time.timezone
        };
        
        dynamicSystemData.cpu = {
            currentLoad: cpu.currentload.toFixed(1) + "%",
            currentLoadUser: cpu.currentload_user.toFixed(1) + "%",
            currentLoadSystem: cpu.currentload_system.toFixed(1) + "%"
        };
        
        dynamicSystemData.memoryRAM = {
            total: (memoryRAM.total/1024/1024).toFixed(1),
            active: (memoryRAM.active/1024/1024).toFixed(1),
            used: (memoryRAM.used/1024/1024).toFixed(1),
            activePercent: (100*memoryRAM.active/memoryRAM.total).toFixed(1) + "%"
        };
        
        dynamicSystemData.memoryDisk = {
            total: (memoryDisk.size/1024/1024).toFixed(1),
            used: (memoryDisk.used/1024/1024).toFixed(1),
            usedPercent: (100*memoryDisk.used/memoryDisk.size).toFixed(1) + "%"
        };
        
        io.emit('socketDynamicSystemData', dynamicSystemData);
        //console.log(dynamicSystemData);
    }
    catch(e){
        console.log(e);
    }
};

const getSensorData = () => {
    const valueAnalogA3 = bonescript.analogRead(inAnalogA3);
    const valueAnalogA4 = bonescript.analogRead(inAnalogA4);
    const valueAnalogA5 = bonescript.analogRead(inAnalogA5);
    const valueAnalogA6 = bonescript.analogRead(inAnalogA6);

    // Emitting a new message. Will be consumed by the client.
    io.emit('socketAnalogValues', {"analogA3": (valueAnalogA3*100).toFixed(1) + '%  ' + (1.8*valueAnalogA3).toFixed(3) + 'V',
                                       "analogA4": (valueAnalogA4*100).toFixed(1) + '%  ' + (1.8*valueAnalogA4).toFixed(3) + 'V',
                                       "analogA5": (valueAnalogA5*100).toFixed(1) + '%  ' + (1.8*valueAnalogA5).toFixed(3) + 'V',
                                       "analogA6": (valueAnalogA6*100).toFixed(1) + '%  ' + (1.8*valueAnalogA6).toFixed(3) + 'V'
    });
};
