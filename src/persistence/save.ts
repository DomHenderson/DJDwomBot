import fs from 'fs';
import { DJSaveData } from "./djSave";
import { ImageBotSaveData } from './imageBotSave';

export interface Save {
	dj: DJSaveData;
	image: ImageBotSaveData;
}

export function DJSave (data: DJSaveData, path: string) {
	const save: Save = JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
	save.dj = data;
	fs.writeFileSync(path, JSON.stringify(save));
}

export function ImageBotSave (data: ImageBotSaveData, path: string) {
	const save: Save = JSON.parse(fs.readFileSync(path, {encoding: 'utf8'}));
	save.image = data;
	fs.writeFileSync(path, JSON.stringify(save));
}