import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { config } from '../config.js';
import { handleInboundMessages } from './message-handler.js';
import { recordFirstConnectionIfNeeded } from './rate-gate.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });

/**
 * Singleton wrapper around a single Baileys socket. Routes subscribe to its
 * events instead of touching the socket directly; there is exactly one
 * connection lifecycle for the whole process.
 */
class SessionManager extends EventEmitter {
  constructor() {
    super();
    this.sock = null;
    this.state = 'disconnected'; // disconnected | qr_pending | connected
    this.qr = null; // latest QR as base64 PNG data URL, memory-only
    this.phoneNumber = null;
    this.starting = false;
  }

  async start() {
    if (this.starting) return;
    this.starting = true;

    fs.mkdirSync(config.authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qr = await QRCode.toDataURL(qr);
        this._setState('qr_pending');
      }

      if (connection === 'open') {
        this.qr = null;
        this.phoneNumber = this.sock.user?.id?.split(':')[0] || null;
        recordFirstConnectionIfNeeded();
        this._setState('connected');
      }

      if (connection === 'close') {
        const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        this.qr = null;
        this._setState('disconnected');

        if (loggedOut) {
          this.emit('logged-out');
          fs.rmSync(config.authDir, { recursive: true, force: true });
          this.sock = null;
          this.starting = false;
          // Wait for an explicit call to start() (or a new /api/qr poll) to
          // re-init, rather than looping on a dead session.
        } else {
          this.sock = null;
          this.starting = false;
          this.start().catch((err) => this.emit('error', err));
        }
      }
    });

    this.sock.ev.on('messages.upsert', (payload) => {
      this.emit('messages.upsert', payload);
      handleInboundMessages(payload);
    });

    this.starting = false;
  }

  _setState(state) {
    this.state = state;
    this.emit('state', { state, phoneNumber: this.phoneNumber });
  }

  getStatus() {
    return { state: this.state, phoneNumber: this.phoneNumber || undefined };
  }

  getQr() {
    return this.state === 'qr_pending' ? this.qr : null;
  }

  async logout() {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch {
        // socket may already be dead; fall through to force-clear below
      }
    }
    fs.rmSync(config.authDir, { recursive: true, force: true });
    this.sock = null;
    this.phoneNumber = null;
    this.qr = null;
    this._setState('disconnected');
    await this.start();
  }

  requireSocket() {
    if (!this.sock || this.state !== 'connected') {
      throw new Error('WhatsApp session is not connected');
    }
    return this.sock;
  }
}

export const sessionManager = new SessionManager();
