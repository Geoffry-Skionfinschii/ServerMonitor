import { CacheType, ApplicationCommandDataResolvable, ApplicationCommandOptionType, ChatInputCommandInteraction, ApplicationCommandData } from "discord.js";
import { ServerEventManager, ServerEvents } from "./server_events";
import Gamedig from "gamedig";


type CommandEntry = {
    discordCommand: ApplicationCommandData;
    method: (interaction: ChatInputCommandInteraction<CacheType>) => void;
};

const CommandList: CommandEntry[] = [
    {
        discordCommand: {
            name: "subscribe",
            description: "Subscribe to a server method",
            options: [
                {
                    name: "event",
                    description: "What event are you subscribing to",
                    type: ApplicationCommandOptionType.String,
                    choices: ServerEvents,
                    required: true
                },
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
            // Handle server subscription
            let caller = interaction.user.id;
            
            let eventName = interaction.options.getString("event", true);
            let protocol = interaction.options.getString("protocol", true);
            let address = interaction.options.getString("address", true);
            let port = interaction.options.getInteger("port", false);

            await interaction.deferReply({ephemeral: true});
            
            try {
                let response = await Gamedig.query({type: protocol as Gamedig.Type, host: address, port: port || undefined});
                await interaction.editReply(`Got response: ${response.name}; ${response.players.length}/${response.maxplayers}; ${response.ping}ms`);

                ServerEventManager.monitorEvent(eventName, protocol, address, port || undefined, caller);
            } catch (e) {
                await interaction.editReply(`Failed to contact server - cancelling command.\n\`\`\`${e}\`\`\``);
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

