import { MessageChannel } from '../botManagers/messageChannel';
import { BotManager } from '../botManagers/botManager';

export interface HelpBot {
	listCommands(botManagers: BotManager[], channel: MessageChannel): Promise<boolean>
}

export function CreateHelpBot() {
	return new HelpBotImpl();
}

class HelpBotImpl implements HelpBot {
	async listCommands(botManagers: BotManager[], channel: MessageChannel): Promise<boolean> {
		await channel.send(
			botManagers.map((b: BotManager) =>
				[
					`${b.getBotName()} commands`,
					...b.getCommandNames().map((name: string) => `    ${name}`)
				].join('\n')
			).join('\n')
		);
		return true;
	}
}