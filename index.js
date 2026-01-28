// 必要なクラスを読み込み
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const axios = require('axios');
const { Readable } = require('stream');     // 音声データを変換
const crypto = require('crypto');
require('dotenv').config(); // .envファイルを読み込む

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

// VOICEVOX settings
const VOICEVOX_URL = 'http://127.0.0.1:50021'

// 暗号化の設定
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const IV_LENGTH = 16;

// 暗号化・復号化の便利関数
// 暗号化関数
function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    // 「IV:暗号文」の形式で返す
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// 復号関数
function decrypt(text) {
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex')
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        return text;
    }
}

// データを保存する関数
function saveFile(filename, data) {
    const jsonString = JSON.stringify(data, null, 2);
    const encryptedData = encrypt(jsonString);
    fs.writeFileSync(filename, encryptedData);
}

// データを読み込む関数
function loadFile(filename) {
    try {
        if (!fs.existsSync(filename)) {
            saveFile(filename, {}); // なければ空で作る
            return {};
        }
        const fileContent = fs.readFileSync(filename, 'utf8');
        const decryptedJson = decrypt(fileContent);
        return JSON.parse(decryptedJson);
    } catch (error) {
        console.error(`${filename}の読み込みエラー: `, error);
        return {};
    }
}

// キャラクターリスト
const VOICE_MAP = {
    'ずんだもん': 3,
    'めたん': 2,
    'ずん子': 1,
    'つむぎ': 8,
    '雨晴': 10,
    '冥鳴': 14,
    'きりたん': 108,
};

// 辞書読み込み
let dictionary = {};
let userSettings = {};

function loadFiles() {
    dictionary = loadFile('dictionary.json');
    userSettings = loadFile('user_settings.json');
    console.log('データを読み込みました(暗号化対応済み');
}
loadFiles();


// Botが起動したときに1回だけ実行
client.once('ready', () => {
    console.log(`${client.user.tag} landed now!`);

    client.user.setPresence({
        activities: [{
            name: 'みんなの会話',
            type: ActivityType.Listening,
        }],
        status: 'online',
    });
});

// VOICEVOXで音声を精製して再生する関数
async function playVoiceVox(text, connection, speakerId = SPEAKER_ID) {
    try {
        if (!text) return;

        // 1. 音声合成のための「クエリ」を作製
        const queryUrl = `${VOICEVOX_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`;

        // POSTリクエストを送る
        const queryRes = await axios.post(queryUrl, {});

        // 2. クエリを基に音声データを生成
        const synthesisUrl = `${VOICEVOX_URL}/synthesis?speaker=${speakerId}`;

        const synthesisRes = await axios.post(synthesisUrl, queryRes.data, {
            responseType: 'arraybuffer'
        });

        // 3. Discordで再生できる形に変換
        const buffer = Buffer.from(synthesisRes.data);
        const stream = Readable.from(buffer);

        // 4. 再生
        const resource = createAudioResource(stream, {
            inputType: StreamType.Arbitrary,
        });
        const player = createAudioPlayer();

        player.on('error', error => {
            console.error('再生エラー:', error);
        });

        connection.subscribe(player);
        player.play(resource);

    } catch (error) {
        console.error('VOICEVOXとの通信エラー');
        if (error.response) {
            console.error('Status: ', error.response.status);
            console.error('Data: ', error.response.data);
        } else {
            console.error('Error: ', error.message);
        }
        console.error('--------------------------------');
    }
}

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

        // 1. コマンドは読み上げない
        if (text.startsWith('!')) return;

        // 辞書適用
        for (const [word, reading] of Object.entries(dictionary)) {
            text = text.split(word).join(reading);
        }

        // 2. コードブロックを削除
        text = text.replace(/```[\s\S]*?```/g, '');

        // 3. URLをURLという言葉に書き換える
        text = text.replace(/https?:\/\/[^\s]+/g, 'URL');

        // 4. Discordのカスタム絵文字を削除
        text = text.replace(/<a?:.+?:\d+>/g, '');

        // 5. 空白を取り除いて，中身がなくなったら読み上げない
        if (!text.trim()) return;

        // 6. 文字数が多すぎる場合はかっとする
        if (text.length > 100) {
            text = text.substring(0, 100) + '，以下省略';
        }

        const speakerId = userSettings[message.author.id] || 3;

        await playVoiceVox(text, connection, speakerId);
    }
});

// Botにログインする
client.login(process.env.DISCORD_TOKEN);
