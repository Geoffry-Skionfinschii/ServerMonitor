import { CacheType, ApplicationCommandDataResolvable, ApplicationCommandOptionType, ChatInputCommandInteraction, ApplicationCommandData, EmbedBuilder } from "discord.js";
import { ServerEventManager, ServerEvents } from "./server_events";
import Gamedig from "gamedig";
import { Database } from "./database/jsondb";


type CommandEntry = {
    discordCommand: ApplicationCommandData;
    method: (interaction: ChatInputCommandInteraction<CacheType>) => void;
};

const CommandList: CommandEntry[] = [
    {
        discordCommand: {
            name: "addserver",
            description: "Add a new server",
            options: [
                {
                    name: "protocol",
                    description: "What protocol does the server use. Run /protocols to see a list, or go to gamedig",
                    type: ApplicationCommandOptionType.String,
                    required: true
                },
                {
                    name: "address",
                    description: "Server address (ip or hostname)",
                    type: ApplicationCommandOptionType.String,
                    required: true
                },
                {
                    name: "port",
                    description: "Server port",
                    type: ApplicationCommandOptionType.Integer,
                    required: false,
                    maxValue: 65535,
                    minValue: 1025
                }
            ]
        },
        async method(interaction) {
            let protocol = interaction.options.getString("protocol", true);
            let address = interaction.options.getString("address", true);
            let port = interaction.options.getInteger("port", false);

            await interaction.deferReply({ephemeral: true});
            
            try {
                let response = await Gamedig.query({type: protocol as Gamedig.Type, host: address, port: port || undefined});

                let newServer = ServerEventManager.getOrCreateServer(protocol, address, port || undefined);

                await interaction.editReply({embeds: [ServerEventManager.generateGenericEmbed(newServer, response).setTitle("Added new server to monitor")]});
            } catch (e) {
                await interaction.editReply(`Failed to contact server - cancelling command.\n\`\`\`${e}\`\`\``);
            }

        },
    },
    {
        discordCommand: {
            name: "subscribe",
            description: "Subscribe to a server event",
            options: [
                {
                    name: "event",
                    description: "What event are you subscribing to",
                    type: ApplicationCommandOptionType.String,
                    choices: ServerEvents,
                    required: true
                },
                {
                    name: "serverid",
                    description: "Pick a server address and protocol from the list",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: Database.getData().servers.map((sv) => { 
                        return {name: ServerEventManager.getServerDisplayName(sv), value: `${sv.id}`}
                    })
                }
            ]
        },
        async method(interaction) {
            let event = interaction.options.getString("event", true);
            let serverid = interaction.options.getString("serverid", true);

            await interaction.deferReply({ephemeral: true});
        
            let targetServer = Database.getData().servers.find((val) => val.id == Number(serverid));
            if(targetServer) {
                ServerEventManager.monitorEvent(event, targetServer.protocol, targetServer.ip, targetServer.port, interaction.user.id);

                await interaction.editReply({embeds: [new EmbedBuilder().setDescription(`You will now recieve messages for the ${event} event, from ${ServerEventManager.getServerDisplayName(targetServer)}`)]});
            } else {
                await interaction.editReply("Server ID does not exist");
            }

        },
    },
    {
        discordCommand: {
            name: "unsubscribe",
            description: "Unsubscribed to a server event",
            options: [
                {
                    name: "address",
                    description: "Server address to unsubscribe from",
                    type: ApplicationCommandOptionType.String
                },
                {
                    name: "port",
                    description: "Specific port to unsubscribe from",
                    type: ApplicationCommandOptionType.Integer
                },
                {
                    name: "event",
                    description: "Unsubscribe from this specific event",
                    type: ApplicationCommandOptionType.String,
                    choices: ServerEvents
                }
            ],
        },
        method(interaction) {
            // Remove subscription
        }
    },
    {
        discordCommand: {
            name: "status",
            description: "Get server status",
            options: [
                {
                    name: "serverid",
                    description: "Pick a server address and protocol from the list",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: Database.getData().servers.map((sv) => { 
                        return {name: ServerEventManager.getServerDisplayName(sv), value: `${sv.id}`}
                    })
                }
            ]
        },
        async method(interaction) {
            let serverid = interaction.options.getString("serverid", true);


            await interaction.deferReply({ephemeral: false});
            
            try {
                let targetServer = Database.getData().servers.find((val) => val.id == Number(serverid));
                if(targetServer) {

                    let response = await Gamedig.query({type: targetServer.protocol as Gamedig.Type, host: targetServer.ip, port: targetServer.port || undefined});
                    await interaction.editReply({embeds: [ServerEventManager.generateGenericEmbed(targetServer, response)]});

                } else {
                    await interaction.editReply("Server ID does not exist");
                }
            } catch (e) {
                await interaction.editReply(`Failed to contact server - cancelling command.\n\`\`\`${e}\`\`\``);
            }
        },
    }
];

class CommandHandler {
    getAllCommands(): ApplicationCommandDataResolvable[] {
        return CommandList.map((v) => v.discordCommand);
    }


    handleCommand(interaction: ChatInputCommandInteraction) {
        let commandName = interaction.commandName;
        for (let command of CommandList) {
            if (command.discordCommand.name == commandName) {
                command.method(interaction);
            }
        }
    }
}

const commandHandler = new CommandHandler();



export {CommandList, commandHandler as CommandHandler};

