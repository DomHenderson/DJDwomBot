import os from 'os';
import * as JSONConfig from './config.json';

export class Config {
	static GetSaveFilePath(): string {
		return `${(os.platform() === 'linux') ? JSONConfig.linuxFilePrefix: JSONConfig.windowsFilePrefix}${JSONConfig.saveFile}`;
	}

	static GetImageLocation(name: string): string|null {
		const matches = JSONConfig.imageLocations
			.filter((entry): boolean => {
				return name === entry.name;
			});

		if (matches.length === 0) {
			return null;
		} else {
			return `${(os.platform() === 'linux') ? JSONConfig.linuxFilePrefix: JSONConfig.windowsFilePrefix}${matches[0].location}`;
		}
	}

	static GetCommandPrefix(): string {
		return JSONConfig.prefix;
	}
}
