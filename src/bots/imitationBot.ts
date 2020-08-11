import * as Discord from 'discord.js';

export class ImitationBot {
    constructor(guilds: Discord.Guild[]) {
        this.guilds = guilds;
        console.log('Guilds:');
        guilds.forEach((guild: Discord.Guild): void => {
            console.log(guild.toString());
        })
        console.log('-');
    }
    async imitate(user: Discord.User): Promise<string> {
        const map = await this.learn(user);
        return [...Array(10).keys()]
            .map((i: number): string => {
                return `${i}: ${this.generate(map).trim()}`;
            })
            .join('\n');
    }

    private async collectMessages(user: Discord.User): Promise<string[]> {
        const messages: string[] = await Promise.all(this.guilds
            .flatMap((guild: Discord.Guild): Discord.Channel[] => {
                return [...guild.channels.cache.values()];
            })
            .map(async (channel: Discord.Channel): Promise<string[]> => {
                if(channel instanceof Discord.TextChannel) {
                    console.log(`Reading channel ${channel.name}`);
                    const sum_messages: string[] = [];
                    let last_id: string|undefined = undefined;
                    let total: number = 0;
                    while(sum_messages.length < 500 && total < 10000) {
                        console.log(sum_messages.length);
                        const options: Discord.ChannelLogsQueryOptions = {limit: 100, before: undefined};
                        if(last_id !== undefined) {
                            options.before = last_id;
                        }

                        try {
                            const messageCollection = await channel.messages.fetch(options);
                            total += messageCollection.size;
                            const last = messageCollection.last();
                            if(last === undefined) {
                                break;
                            }
                            last_id = last.id;
                            const userMessages = [...messageCollection.values()]
                                .filter((m: Discord.Message): boolean => {
                                    return m.author.id === user.id;
                                });
                            const messageContents = userMessages
                                .map((m: Discord.Message): string => {
                                    return m.content;
                                })
                            sum_messages.push(...messageContents);
                        } catch (e) {
                            break;
                        }
                    }
                    return sum_messages;
                } else {
                    return Promise.resolve([]);
                }
            }))
            .then((byGuild: string[][]): string[] => {
                return byGuild.flat();
            });
        console.log(messages);
        return messages;
    }

    private async learn(user: Discord.User): Promise<Map<string|null, Map<string|null, number>>> {
        const messages: string[] = await this.collectMessages(user);
        const pairs = messages
            .map((str: string): string[] => {
                return str.replace(/(?:\r\n|\r|\n)/g, ' \n ').split(' ');
            })
            .flatMap((tokens: string[]): [string|null, string|null][] => {
                const fst = [null, ...tokens];
                const snd = [...tokens, null];
                return fst.map((x: string|null, i:number): [string|null, string|null] => {
                    return [x, snd[i]];
                });
            });
        const map: Map<string|null, Map<string|null, number>> = new Map<string|null, Map<string|null, number>>();
        pairs.forEach(([fst, snd]: [string|null, string|null]): void => {
            if(!map.has(fst)) {
                map.set(fst, new Map<string|null, number>());
            }
            const subMap: Map<string|null, number> = map.get(fst)!;
            if(!subMap.has(snd)) {
                subMap.set(snd, 0);
            }
            subMap.set(snd, subMap.get(snd)! + 1);
        });
        console.log(map);
        return map;
    }

    private generate(map: Map<string|null, Map<string|null, number>>): string {
        let word: string|null = null;
        let gen: string = '';
        let i: number = 0;
        do {
            const options = map.get(word);
            if (options === undefined) {
                word = null;
            } else {
                const total: number = [...options.values()]
                    .reduce((prev: number, x: number) => prev + x, 0);
                const random = Math.floor(Math.random()*total);
                let result: string|null = null;
                [...options.entries()]
                    .reduce((remaining: number, [s, n]: [string|null, number]): number => {
                        if (remaining < 0) {
                            return remaining;
                        } else if (remaining < n) {
                            result = s;
                            return -1;
                        } else {
                            return remaining - n;
                        }
                    }, random);
                if(result === null) {
                    word = null;
                } else {
                    gen = `${gen} ${result}`;
                    word = result;
                }
            }
            ++i;
        } while (word !== null && i < 1000);
        console.log(gen);
        return gen;
    }

    private guilds: Discord.Guild[];
}