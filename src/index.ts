
import {Database} from "./database/jsondb";
import { Client } from 'discord.js';
import dotenv from 'dotenv';

import {CommandHandler} from './commands';
import { ServerEventManager } from "./server_events";

dotenv.config();

const client = new Client({intents: ["Guilds", "DirectMessages"]});


client.on('ready', async () => {
    console.log("Ready!");
    await client.guilds.resolve("693719703452909568")?.commands.set(CommandHandler.getAllCommands());

    ServerEventManager.performServerSweep(client);
});

client.on('interactionCreate', (interaction) => {
    if (interaction.isChatInputCommand()) {
        CommandHandler.handleCommand(interaction);
    }
})

client.login(process.env.DISCORD_TOKEN);

