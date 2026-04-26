const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

class FileService {
  constructor(db) {
    this.db = db;
    this.storageDir = path.resolve(config.files.storageDir);
    this.sharedFolders = config.files.sharedFolders.map(f => path.resolve(f));
    
    this.initStorage();
  }
  
  initStorage() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      console.log('[FileService] Created storage directory:', this.storageDir);
    }
    
    this.sharedFolders.forEach(folder => {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        console.log('[FileService] Created shared folder:', folder);
      }
    });
  }
  
  generateHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
  
  async saveFile(buffer, originalName, nodeId) {
    const id = uuidv4();
    const ext = path.extname(originalName);
    const filename = `${id}${ext}`;
    const filePath = path.join(this.storageDir, filename);
    
    fs.writeFileSync(filePath, buffer);
    
    const stats = fs.statSync(filePath);
    const mimeType = this.getMimeType(ext);
    const hash = await this.generateHash(filePath);
    
    const fileInfo = {
      id,
      nodeId,
      name: originalName,
      path: filePath,
      size: stats.size,
      mimeType,
      hash,
      shared: 1
    };
    
    try {
      this.db.files.insert(fileInfo);
    } catch (err) {
      console.error('[FileService] DB insert error:', err.message);
    }
    
    console.log('[FileService] File saved:', originalName, '(' + stats.size + ' bytes)');
    
    return fileInfo;
  }
  
  getFile(fileId) {
    try {
      const files = this.db.files.getAll();
      return files.find(f => f.id === fileId);
    } catch (err) {
      console.error('[FileService] Get file error:', err.message);
      return null;
    }
  }
  
  getAllFiles() {
    try {
      return this.db.files.getAll();
    } catch (err) {
      console.error('[FileService] Get files error:', err.message);
      return [];
    }
  }
  
  getFilesByNode(nodeId) {
    try {
      return this.db.files.getByNode(nodeId);
    } catch (err) {
      console.error('[FileService] Get node files error:', err.message);
      return [];
    }
  }
  
  findByHash(hash) {
    try {
      return this.db.files.getByHash(hash);
    } catch (err) {
      return null;
    }
  }
  
  deleteFile(fileId) {
    const file = this.getFile(fileId);
    if (!file) return false;
    
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      this.db.files.delete(fileId);
      console.log('[FileService] File deleted:', file.name);
      return true;
    } catch (err) {
      console.error('[FileService] Delete error:', err.message);
      return false;
    }
  }
  
  getMimeType(ext) {
    const types = {
      '.html': 'text/html',
      '.htm': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.avi': 'video/x-msvideo'
    };
    return types[ext.toLowerCase()] || 'application/octet-stream';
  }
  
  async scanSharedFolders() {
    const files = [];
    
    for (const folder of this.sharedFolders) {
      await this.scanFolder(folder, files);
    }
    
    return files;
  }
  
  async scanFolder(folder, files) {
    if (!fs.existsSync(folder)) return;
    
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(folder, entry.name);
      
      if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        const ext = path.extname(entry.name);
        
        files.push({
          name: entry.name,
          path: fullPath,
          size: stats.size,
          mimeType: this.getMimeType(ext),
          modified: stats.mtime
        });
      } else if (entry.isDirectory()) {
        await this.scanFolder(fullPath, files);
      }
    }
  }
  
  getStats() {
    const totalSize = this.getFolderSize(this.storageDir);
    const fileCount = fs.readdirSync(this.storageDir).length;
    
    return {
      storageDir: this.storageDir,
      totalSize,
      fileCount,
      maxFileSize: config.files.maxFileSize * 1024 * 1024
    };
  }
  
  getFolderSize(folder) {
    if (!fs.existsSync(folder)) return 0;
    
    let size = 0;
    const entries = fs.readdirSync(folder, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(folder, entry.name);
      if (entry.isFile()) {
        size += fs.statSync(fullPath).size;
      } else if (entry.isDirectory()) {
        size += this.getFolderSize(fullPath);
      }
    }
    
    return size;
  }
}

module.exports = FileService;
