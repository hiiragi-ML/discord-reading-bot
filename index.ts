import { Client, GatewayIntentBits, Events, Message, Interaction, GuildMember, ActivityType } from 'discord.js'
import { joinVoiceChannel, VoiceConnection } from '@discordjs/voice';
import dotenv from 'dotenv';
dotenv.config();

import { saveFile, loadFile } from './utils/storage';
import { playVoicevox, VOICE_MAP } from './utils/voicevox';

import { playGoogleTTS } from './utils/googletts';

// 型の定義
// 辞書: キーも値も文字列
interface Dictionary{
    [word: string]: string;
}
// ユーザー設定: キーはユーザーID(string), 値はキャラID(number)
interface UserSettings{
    [userId: string]: number;
}

// クライアント(Bot)のインスタンスを作成
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,           // サーバーに関する情報
        GatewayIntentBits.GuildMessages,    // メッセージに関する情報
        GatewayIntentBits.MessageContent,   // メッセージの内容に関する情報
        GatewayIntentBits.GuildVoiceStates, // ボイスチャンネルに関する情報
    ],
});

// Botが現在接続している「コネクション」を保存しておく場所
let connection: VoiceConnection | null = null;

let dictionary: Dictionary = {};
let userSettings: UserSettings = {};

let disconnectTimer: NodeJS.Timeout | null = null;

function initData() {
    // ジェネリクスを使ってDictionary型として読み込ませる
    dictionary = loadFile<Dictionary>('dictionary.json');
    userSettings = loadFile<UserSettings>('user_settings.json');
    console.log('データを読み込みました(暗号化対応済み)');
}
initData();


// Botが起動したときに1回だけ実行
client.once('clientReady', () => {
    console.log(`${client.user?.tag} landed now!`);

    client.user?.setPresence({
        activities: [{
            name: 'みんなの会話',
            type: ActivityType.Listening,
        }],
        status: 'online',
    });
});


// スラッシュコマンド処理
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    // チャットコマンド以外は無視
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // --- /join ---
    if (commandName === 'join') {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            await interaction.reply({ content: 'まずはボイスチャンネルに入ってください!', ephemeral: true });
            return;
        }

        if(!interaction.guild || !interaction.guild.voiceAdapterCreator){
            await interaction.reply({ content: 'ギルド情報が取得できませんでした', ephemeral: true });
            return;
        }

        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });
        await interaction.reply('接続しました!🔊');
    }

    // --- /leave ---
    else if (commandName === 'leave') {
        if (connection) {
            connection.destroy();
            connection = null;
            await interaction.reply('切断しました');
        } else {
            await interaction.reply({ content: '接続していません', ephemeral: true });
        }
    }

    // --- /voice ---
    else if (commandName === 'voice') {
//        const charaName = interaction.options.getString('character', true);
//
//        if (VOICE_MAP[charaName] !== undefined) {
//            userSettings[interaction.user.id] = VOICE_MAP[charaName];
//            saveFile('user_settings.json', userSettings);
//            await interaction.reply(`声を「${charaName}」に変更しました`);
//        } else {
//            const list = Object.keys(VOICE_MAP).join('，');
//            await interaction.reply({ content: `そのキャラは登録されていません。\n使えるキャラ: ${list}`, ephemeral: true });
//        }
        await interaction.reply({ content: '現在はGoogle翻訳モードなので声の変更はできません' });
    }

    // --- /add ---
    else if (commandName === 'add') {
        const word = interaction.options.getString('word', true);
        const reading = interaction.options.getString('reading', true);

        dictionary[word] = reading;
        saveFile('dictionary.json', dictionary);
        await interaction.reply(`辞書登録: ${word} → ${reading} 📝`);
    }
});

// 読み上げ処理
client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (message.content.startsWith('!')) return;

    if (!connection) return;

    let text = message.cleanContent;

    // --- フィルタリング処理 ---
    // メンションをIDではなく名前に変換したテキストを取得

    // 辞書適用
    for (const [word, reading] of Object.entries(dictionary)) {
        text = text.split(word).join(reading);
    }

    // フィルタリング
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/https?:\/\/[^\s]+/g, 'URL');
    text = text.replace(/<a?:.+?:\d+>/g, '');
    if (!text.trim()) return;

    // 6. 文字数が多すぎる場合はかっとする
    if (text.length > 100) {
        text = text.substring(0, 100) + '，以下省略';
    }

    // const speakerId = userSettings[message.author.id] || 3;
    // await playVoicevox(text, connection, speakerId);
    await playGoogleTTS(text, connection);
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    // Bot自身がボイスチャンネルにいなければ何もしない
    const guild = oldState.guild || newState.guild;
    const botMember = guild.members.me;

    if(!botMember || !botMember.voice.channel){
        // BotがVCにいないならタイマーも不要
        if(disconnectTimer){
            clearTimeout(disconnectTimer);
            disconnectTimer = null;
        }
        return;
    }

    // Botがいるチャンネル
    const currentChannel = botMember.voice.channel;

    // Botがいるチャンネルの人間の数を数える
    const humanCount = currentChannel.members.filter(member => !member.user.bot).size;

    // 人間が0人になったら
    if(humanCount === 0){
        if(!disconnectTimer){
            console.log('誰もいなくなったので，10秒後に切断します');

            disconnectTimer = setTimeout(() => {
                if(connection){
                    connection.destroy();
                    connection = null;
                    console.log('自動切断しました 👋');
                }
                disconnectTimer = null;
            }, 10*1000);
        }
    }
    else{
        if(disconnectTimer){
            console.log('人がいるので自動切断をキャンセルしました 👍');
            clearTimeout(disconnectTimer);
            disconnectTimer = null;
        }
    }
});

// Botにログインする
client.login(process.env.DISCORD_TOKEN);
