// 必要なクラスを読み込み
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

require('dotenv').config(); // .envファイルを読み込む

const { saveFile, loadFile } = require('./utils/storage');
const { playVoicevox, VOICE_MAP } = require('./utils/voicevox');

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
let connection = null;

let dictionary = {};
let userSettings = {};

function initData() {
    dictionary = loadFile('dictionary.json');
    userSettings = loadFile('user_settings.json');
    console.log('データを読み込みました(暗号化対応済み)');
}
initData();


// Botが起動したときに1回だけ実行
client.once('clientReady', () => {
    console.log(`${client.user.tag} landed now!`);

    client.user.setPresence({
        activities: [{
            name: 'みんなの会話',
            type: ActivityType.Listening,
        }],
        status: 'online',
    });
});


// messageが送信されたときに実行される
client.on('messageCreate', async (message) => {
    // Bot自身の発言は無視する
    if (message.author.bot) return;

    // キャラ変更コマンド(!voice キャラ名)
    if (message.content.startsWith('!voice ')) {
        const args = message.content.split(' ');
        const charaName = args[1];

        if (VOICE_MAP[charaName]) {
            // そのユーザーの設定として保存
            userSettings[message.author.id] = VOICE_MAP[charaName];
            saveFile('user_settings.json', userSettings);

            message.reply(`声を「${charaName}」に変更しました。`);
        } else {
            const list = Object.keys(VOICE_MAP).join(', ');
            message.reply(`そのキャラは登録されていません。\n使えるキャラ: ${list}`);
        }
        return;
    }

    if (message.content.startsWith('!voice')) {
        const list = Object.keys(VOICE_MAP).join(', ');
        message.reply(`使えるキャラ: ${list}`);
        return;
    }

    // 辞書登録コマンド(!add 単語 読み方)
    if (message.content.startsWith('!add ')) {
        const args = message.content.split(' ');
        if (args.length < 3) return;

        dictionary[args[1]] = args[2];
        saveFile('dictionary.json', dictionary);
        message.reply(`辞書登録: ${args[1]} → ${args[2]}`);
        return;
    }

    // 1. 「!join」コマンドでユーザーがいるボイスチャンネルに入る
    if (message.content === '!join') {
        if (message.member.voice.channel) {
            connection = joinVoiceChannel({
                channelId: message.member.voice.channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
            message.reply('ボイスチャンネルに参加しました！読み上げを開始します。');
        } else {
            message.reply('まずはあなたがボイスチャンネルに入ってください!');
        }
        return;
    }

    // 2. 「!leave」コマンドで，ボイスチャンネルから出る
    if (message.content === '!leave') {
        if (connection) {
            connection.destroy();
            connection = null;
            message.reply('読み上げを終了しました。');
        }
        return;
    }

    // 3. ボイスチャンネルに接続中なら，チャットを読み上げる
    if (connection) {
        // チャットのフィルタリングも可能

        // --- フィルタリング処理 ---
        // メンションをIDではなく名前に変換したテキストを取得
        let text = message.cleanContent;
        if (text.startsWith('!')) return;

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

        const speakerId = userSettings[message.author.id] || 3;
        await playVoicevox(text, connection, speakerId);
    }
});

// Botにログインする
client.login(process.env.DISCORD_TOKEN);
