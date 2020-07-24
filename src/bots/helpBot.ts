import { BotManager } from '../botManagers/botManager';
import { ModGate } from '../botManagers/modGate';
import { ValidMessage } from '../botManagers/validMessage';
import { PermissionLevel, CommandPrototype } from '../botManagers/command';

export interface HelpBot {
	listCommands(botManagers: BotManager[], message: ValidMessage, modGate: ModGate|null): Promise<boolean>
}

export function CreateHelpBot(): HelpBot {
	return new HelpBotImpl();
}

class HelpBotImpl implements HelpBot {
	async listCommands(botManagers: BotManager[], message: ValidMessage, modGate: ModGate|null): Promise<boolean> {
		const commandList: string = createCommandList(botManagers, modGate, message.guild.id);
		const formatExplanation: string|null = createFormatExplanation(botManagers, modGate, message.guild.id);
		await message.channel.send(`${commandList}${formatExplanation ? `\n${formatExplanation}` : ''}`);
		return true;
	}
}

function createCommandList(botManagers: BotManager[], modGate: ModGate|null, guildId: string): string {
	return botManagers
		.map(createIndividualCommandList(guildId, modGate))
		.join('\n');
}

function createIndividualCommandList(guildId: string, modGate: ModGate|null): (botManager: BotManager) => string {
	return (botManager: BotManager) => {
		const commands: string = botManager.getCommandPrototypes()
			.map((prototype: CommandPrototype): string => {
				const unformatted: string = prototype.fullDescription;
				const p: PermissionLevel = modGate?.getPermissionLevel(guildId, prototype) ?? PermissionLevel.Anyone;
				switch(p) {
				case PermissionLevel.Anyone:
					return `    ${unformatted}`;
				case PermissionLevel.Mod:
					return `    *${unformatted}*`;
				case PermissionLevel.Owner:
					return `    ~~${unformatted}~~`;
				}
			})
			.join('\n');
		return `${botManager.getBotName()} commands\n${commands}`;
	};
}

function createFormatExplanation(botManagers: BotManager[], modGate: ModGate|null, guildId: string): string|null {
	if (modGate === null) {
		return null;
	}

	let result: string[] = [];

	if (modGate.hasPermissionLevel(guildId, PermissionLevel.Mod, botManagers)) {
		result = ['*command* means mod-only'];
	}

	if (modGate.hasPermissionLevel(guildId, PermissionLevel.Owner, botManagers)) {
		result = result.concat(['~~command~~ means owner-only']);
	}

	return result.join('\n');
}