import os from 'os';

import { BotManager } from './botManagers/botManager';
import { CommandPrototype } from './botManagers/command';

export function validate(botManagers: BotManager[]): boolean {
	
	console.log(`OS: ${os.platform()}`);

	const commandList: CommandPrototype[] = botManagers
		.map((botManager: BotManager): CommandPrototype[] => botManager.getCommandPrototypes())
		.flat();

	const results: [string, boolean][] = [
		['lowercase', allCommandNamesLowercase(commandList)],
		['arg intervals separate', argumentListsDoNotOverlap(commandList)]
	];

	console.log(results);

	return results.every(([name, result]: [string, boolean]): boolean => result);
}

function allCommandNamesLowercase(commandList: CommandPrototype[]): boolean {
	return commandList
		.every((c: CommandPrototype): boolean => {
			return c.names
				.every((name: string): boolean => {
					return name === name.toLocaleLowerCase();
				});
		});
}

function argumentListsDoNotOverlap(commandList: CommandPrototype[]): boolean {
	return testPairwise(
		commandList,
		(l: CommandPrototype, r: CommandPrototype): boolean => {
			//If the commands do not share a name, the test passes
			if(!arrayOverlap(l.names, r.names)) return true;

			//If they do, the argCount intervals must not overlap
			return !intervalOverlap(l.minArgs, l.maxArgs, r.minArgs, r.maxArgs);
		}
	);
}

function arrayOverlap<T>(lArr: T[], rArr: T[]): boolean {
	//Return whether or not some element of lArr is included in rArr
	return lArr.some((l: T): boolean => rArr.includes(l));
}

function intervalOverlap(lMin: number, lMax: number, rMin: number, rMax: number): boolean {
	return lMin <= rMax && lMax >= rMin;

	//lMin > rMax <=> left interval fully after right interval
	//lMax < rMin <=> left interval fully before right interval
	//If neither of these are the case, there is overlap
}

function testPairwise<T>(data: T[], func: ((l: T, r: T) => boolean)): boolean {
	return data
		.map((t: T): [T, T[]] => {
			return [t, data.filter((x: T): boolean => x !== t)];
		})
		.every(([l, rs]: [T, T[]]): boolean => {
			return rs.every((r: T): boolean => func(l, r));
		});
}