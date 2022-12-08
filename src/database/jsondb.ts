import fs from 'fs';

class JsonDB<T> {
    private path: string;
    private data: T | null;

    constructor(path: string, initialValue: T) {
        this.path = path;
        
        if (fs.existsSync(path)) {
            let readDatabase = fs.readFileSync(path, {"encoding": 'utf-8'});
            this.data = JSON.parse(readDatabase);
        } else {
            this.data = initialValue;
            this._saveDatabase();
        }
    }

    getData() {
        if(this.data == null) {
            throw new Error("Database not initialised");
        }
        return this.data;
    }

    private _saveDatabase() {
        fs.writeFileSync(this.path, JSON.stringify(this.data, undefined, 4));
    }

    updateData(newData: T | undefined = undefined) {
        if (newData) {
            this.data = newData;
        }

        this._saveDatabase();
    }
}

type ServerEntry = {
    id: number,
    protocol: string,
    ip: string,
    port: number | undefined,
    users: number[],
    
    previousServerState?: ServerState,
}

type ServerState = {
    online: boolean,
    players: string[]
}

type EventEntry = {
    server: number;
    event_id: string;
}

type UserEntry = {
    id: number,
    discord_id: string,
    events: EventEntry[]
}

type DatabaseType = {
    servers: ServerEntry[],
    users: UserEntry[],
}

const Database = new JsonDB<DatabaseType>("./db.json", {servers: [], users: []});

export {Database, ServerEntry, UserEntry, EventEntry};