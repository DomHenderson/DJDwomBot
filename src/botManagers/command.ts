import { ValidMessage } from './validMessage';

export enum PermissionLevel {
	Anyone,
	Mod,
	Owner
}

export class CommandPrototype {
	constructor(
		public names: string[],
		public argNames: string[] = [],
		public minArgs: number = 0,
		public maxArgs: number = Infinity,
		public permissionLevel: PermissionLevel = PermissionLevel.Anyone
	) { }

	get id(): string {
		return `${this.names[0]}${this.minArgs}`;
	}

	get aliasString(): string {
		return this.names.join(' / ');
	}

	get fullDescription(): string {
		const argString: string = this.argNames
			.map((n: string): string => {
				return `<${n}>`;
			})
			.join(' ');
		if(argString === '') {
			return this.aliasString;
		} else {
			return `${this.aliasString} ${argString}`;
		}
	}
}

export class Command<BotType> extends CommandPrototype {
	constructor(
		names: string[],
		public func: (m: ValidMessage, b: BotType) => Promise<boolean>,
		argNames: string[] = [],
		minArgs: number = 0,
		maxArgs: number = Infinity,
		permissionLevel: PermissionLevel = PermissionLevel.Anyone
	) {
		super(names, argNames, minArgs, maxArgs, permissionLevel);
	}
}
