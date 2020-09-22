import * as Discord from 'discord.js';
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
		const initialBotManagers: [BotManager, Boolean][] = botManagers.map((b: BotManager) => [b, false]);
		const initialText: string = createCommandList(initialBotManagers, modGate, message.guild.id);
		const sentMessage = await message.channel.send(initialText);
		const cancelEmoji = '❌';
		const validResponses: Map<string, BotManager|null> = new Map<string, BotManager|null>([
			...botManagers.map((b: BotManager): [string, BotManager|null] => [
				b.getBotEmoji(),
				b
			]),
			[cancelEmoji, null]
		]);
		const filter: Discord.CollectorFilter = (reaction, user: Discord.User) => {
			return [...validResponses.keys()].includes(reaction.emoji.name);
		}
		const collector = sentMessage.createReactionCollector(filter, { time: 120000, dispose: true });

		collector.on('collect', (reaction, user) => {
			console.log(`collected ${reaction.emoji.name}`);
			const reactions = [...sentMessage.reactions.cache.values()]
				.filter((r) => r.count !== null && r.count > 1)
				.map((r) => r.emoji.name);
			
			if(reactions.includes(cancelEmoji)) {
				sentMessage.delete();
			} else {
				const updatedCommands = createCommandList(botManagers.map((b) => [b, reactions.includes(b.getBotEmoji())]), modGate, message.guild.id);
				const formatExplanation: string|null = createFormatExplanation(botManagers.filter((b) => reactions.includes(b.getBotEmoji())), modGate, message.guild.id);
				sentMessage.edit(`${updatedCommands}${formatExplanation ? `\n${formatExplanation}` : ''}`);
			}
		});

		collector.on('remove', (reaction, user) => {
			console.log(`${reaction.emoji.name} removed`);
			const reactions = [...sentMessage.reactions.cache.values()]
				.filter((r) => r.count !== null && r.count > 1)
				.map((r) => r.emoji.name);
			
			if(reactions.includes(cancelEmoji)) {
				sentMessage.delete();
			} else {
				const updatedCommands = createCommandList(botManagers.map((b) => [b, reactions.includes(b.getBotEmoji())]), modGate, message.guild.id);
				const formatExplanation: string|null = createFormatExplanation(botManagers.filter((b) => reactions.includes(b.getBotEmoji())), modGate, message.guild.id);
				sentMessage.edit(`${updatedCommands}${formatExplanation ? `\n${formatExplanation}` : ''}`);
			}
		});

		collector.on('end', collected => {
			sentMessage.delete();
		}

		try {
			for(const b of botManagers) {
				await sentMessage.react(b.getBotEmoji());
			}
			await sentMessage.react(cancelEmoji);
		} catch (e) {
			console.log(e);
		}
		return true;
	}
}

function createCommandList(botManagers: [BotManager, Boolean][], modGate: ModGate|null, guildId: string): string {
	return botManagers
		.map(([botManager, detail]: [BotManager, Boolean]) => {
			const [title, commands]: [string, string] = createIndividualCommandList(guildId, modGate, botManager);
			return detail
				? `${title}\n${commands}`
				: title;
		})
		.join('\n');
}

function createIndividualCommandList(guildId: string, modGate: ModGate|null, botManager: BotManager): [string, string] {
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
	return [`${botManager.getBotEmoji()}: ${botManager.getBotName()} commands`, commands];
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