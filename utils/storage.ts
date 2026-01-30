import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// 型定義: 環境変数がなかった場合の安全策
const KEY_STRING = process.env.ENCRYPTION_KEY || '';
if(!KEY_STRING){
    console.error("❌ ENCRYPTION_KEYが設定されていません");
    process.exit(1);
}

// 暗号化の設定
const ENCRYPTION_KEY = Buffer.from(KEY_STRING, 'hex');
const IV_LENGTH = 16;

// 暗号化関数
function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// 復号関数
function decrypt(text: string): string {
    try {
        const textParts = text.split(':');
        const ivHex = textParts.shift();
        if(!ivHex) return text;
        
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        return text; // 暗号化されていなければそのまま返す
    }
}

// データを保存する
export function saveFile<T>(filename: string, data: T): void {
    const jsonString = JSON.stringify(data, null, 2);
    const encryptedData = encrypt(jsonString);
    fs.writeFileSync(filename, encryptedData);
}

// データを読み込む
export function loadFile<T>(filename: string): T {
    try {
        if (!fs.existsSync(filename)) {
            saveFile(filename, {});
            return {} as T;
        }
        const fileContent = fs.readFileSync(filename, 'utf8');
        const decryptedJson = decrypt(fileContent);
        return JSON.parse(decryptedJson) as T;
    } catch (error) {
        console.error(`${filename}の読み込みエラー: `, error);
        return {} as T;
    }
}
