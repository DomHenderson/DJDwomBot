import os from 'os';
import fs from 'fs';
import { Config } from '../config';
import { DJSaveData } from './djSave';
import { ImageBotSaveData } from './imageBotSave';
import { ModBotSaveData } from './modBotSave';

export interface Save {
	DJ: DJSaveData;
	Image: ImageBotSaveData;
	Mod: ModBotSaveData;
}

export class GuildSaveData<T> {
	constructor (
		public guildId: string,
		public data: T
	) {}
}

function GenericSave (updateSave: (s: Save) => void): void {
	const fileName = Config.GetSaveFilePath();
	const save: Save = JSON.parse(fs.readFileSync(fileName, {encoding: 'utf8'}));
	updateSave(save);
	fs.writeFileSync(fileName, JSON.stringify(save));
}

export function DJSave (data: DJSaveData): void {GenericSave((s: Save) => {s.DJ = data;});}
export function ImageBotSave (data: ImageBotSaveData): void {GenericSave((s: Save) => {s.Image = data;});}
export function ModBotSave (data: ModBotSaveData): void {GenericSave((s: Save) => {s.Mod = data;});}
