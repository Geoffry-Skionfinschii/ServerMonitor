import { Client } from "discord.js";
import Gamedig from "gamedig";
import { Database, ServerEntry, UserEntry } from "./database/jsondb";

type ServerEventList = "connect" | "disconnect" | "empty" | "not_empty" | "offline" | "online";

const ServerEvents = [
    {
        name: "connect",
        value: "connect"
    },
    {
        name: "disconnect",
        value: "disconnect"
    },
    {
        name: "empty",
        value: "empty"
    },
    {
        name: "notempty",
        value: "not_empty"
    },
    {
        name: "offline",
        value: "offline"
    },
    {
        name: "online",
        value: "online"
    }
]

class UserEventManager {
    static createUserEvent(userId: string, event: string, server: ServerEntry) {
        let usr = UserEventManager.getOrCreateUser(userId);
        
        for (let ev of usr.events) {
            if (ev.event_id == event && ev.server == server.id) {
                return false;
            }
        }

        usr.events.push({event_id: event, server: server.id});
        Database.updateData();
        return usr;
    }

    static getOrCreateUser(userId: string) {
        let db = Database.getData();
        for (let indx in db.users) {
            let usr = db.users[indx];
            if (usr.discord_id == userId) {
                return usr;
            }
        }

        let usr: UserEntry = {id: db.users.length, discord_id: userId, events: []};
        db.users.push(usr);
        Database.updateData();
        return usr;
    }

    static getUserId(id: number) {
        let db = Database.getData();
        if (db.users[id]) {
            return db.users[id];
        }
        return null;
    }
}

class ServerEventManager {
    static async performServerSweep(client: Client) {
        console.log("Performing server sweep");
        let db = Database.getData();
        let promiseArray = [];
        for (let server of db.servers) {
            if (server.users.length == 0) continue;
            
            promiseArray.push(Gamedig.query({type: server.protocol as Gamedig.Type, host: server.ip, port: server.port}).then((resp) => {
                ServerEventManager.serverStateUpdate(client, server, resp);
            }).catch((rej) => {
                ServerEventManager.serverStateUpdate(client, server, null);
            }));
        }
        await Promise.allSettled(promiseArray);

        setTimeout(() => ServerEventManager.performServerSweep(client), 30000);
    }

    static async serverSendEvent(client: Client, event: ServerEventList, server: ServerEntry, player_name?: string) {
        for (let usrId of server.users) {
            let user = UserEventManager.getUserId(usrId);
            if (user == null) continue;

            let valid_event = user.events.find((val) => val.event_id == event && val.server == server.id);
            if (valid_event) {
                let discordUser = await client.users.fetch(user.discord_id);
                if(!discordUser) {
                    console.error(`Failed to send message to user ${user.discord_id}:${user.id}`);
                    continue;
                }
                switch (event) {
                    case 'connect':
                        discordUser.send(`User connected: ${player_name}`);
                        break;
                    case 'disconnect':
                        discordUser.send(`User disconnected: ${player_name}`);
                        break;
                    case 'empty':
                        discordUser.send(`Server is empty`);
                        break;
                    case 'not_empty':
                        discordUser.send(`Server is not empty`);
                        break;
                    case 'offline':
                        discordUser.send(`Server is offline`);
                        break;
                    case 'online':
                        discordUser.send(`Server is online`);
                        break;
                }
            }
        }
    }

    static serverStateUpdate(client: Client, server: ServerEntry, resp: Gamedig.QueryResult | null) {
        if(resp == null) {
            if (server.previousServerState?.online == true) {
                // send event for server turned offline
                this.serverSendEvent(client, 'offline', server);
                console.log("Server offline");
            }
            server.previousServerState = {online: false, players: []};
            Database.updateData();
            return;
        }

        if (server.previousServerState?.online == false) {
            // send event for server turned online
            this.serverSendEvent(client, 'online', server);

            console.log("Server online");
        }

        let mappedPlayerNames = resp.players.map((p) => p.name || "");

        if (server.previousServerState) {
            if (server.previousServerState.players.length == 0 && resp.players.length >= 1) {
                // Send event for not empty
                this.serverSendEvent(client, 'not_empty', server);

                console.log("Server no longer empty");
            } else if (server.previousServerState.players.length > 0 && resp.players.length == 0) {
                // Send event for empty
                this.serverSendEvent(client, 'empty', server);

                console.log("Server empty");
            }

            // New players (connect)
            for (let newPlayer of mappedPlayerNames) {
                if (server.previousServerState.players.includes(newPlayer)) continue;
                this.serverSendEvent(client, 'connect', server, newPlayer);

                console.log(`Player Connected ${newPlayer}`);
            }

            // Old players (disconnect)
            for (let oldPlayer of server.previousServerState.players) {
                if (mappedPlayerNames.includes(oldPlayer)) continue;

                this.serverSendEvent(client, 'disconnect', server, oldPlayer);

                console.log(`Player Disconnected ${oldPlayer}`);
            }
        }

        server.previousServerState = {online: true, players: mappedPlayerNames};
        Database.updateData();
    }

    static monitorEvent(event: string, protocol: string, ip: string, port: number | undefined, userId: string) {
        let srv = this.getOrCreateServer(protocol, ip, port);

        let usr = UserEventManager.createUserEvent(userId, event, srv);
        if (usr != false) {
            if(!srv.users.includes(usr.id)) {
                srv.users.push(usr.id);
            }
            Database.updateData();
            // We succeeded, add the user to the list of known users.
        } else {
            // Failed to create event. Do we need this server any more??
            ServerEventManager.verifyServer(ip, port);
        }
    }

    static getOrCreateServer(protocol: string, ip: string, port: number | undefined) {
        let db = Database.getData();
        for (let indx in db.servers) {
            let srv = db.servers[indx];
            if (srv.protocol == protocol && srv.ip == ip && srv.port == port) return srv;
        }

        let srv: ServerEntry = {id: db.servers.length, protocol: protocol, ip: ip, port: port, users: []};
        db.servers.push(srv);
        Database.updateData();
        return srv;
    }

    static verifyServer(ip: string, port: number | undefined) {
        // Search list and delete any entries that have no references.
    }
}


export {ServerEvents, ServerEventManager, UserEventManager}