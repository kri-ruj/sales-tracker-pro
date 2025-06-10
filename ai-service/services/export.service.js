const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const markdownPdf = require('markdown-pdf');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

class ExportService {
    constructor() {
        this.exportDir = path.join(__dirname, '..', 'exports');
        this.ensureExportDir();
    }

    async ensureExportDir() {
        try {
            await fs.mkdir(this.exportDir, { recursive: true });
        } catch (error) {
            logger.error('Failed to create export directory:', error);
        }
    }

    /**
     * Export conversation to JSON format
     */
    async exportToJSON(sessionData) {
        try {
            const { sessionId, messages, metadata } = sessionData;
            const filename = `conversation_${sessionId}_${Date.now()}.json`;
            const filepath = path.join(this.exportDir, filename);

            const exportData = {
                sessionId,
                exportDate: new Date().toISOString(),
                metadata: {
                    ...metadata,
                    messageCount: messages.length,
                    exportVersion: '1.0'
                },
                messages: messages.map(msg => ({
                    id: msg.id,
                    type: msg.message_type,
                    content: msg.content,
                    timestamp: msg.created_at,
                    metadata: msg.metadata
                }))
            };

            await fs.writeFile(filepath, JSON.stringify(exportData, null, 2));

            logger.info('Exported conversation to JSON', { sessionId, filename });

            return {
                success: true,
                filename,
                filepath,
                format: 'json',
                size: (await fs.stat(filepath)).size
            };
        } catch (error) {
            logger.error('JSON export failed:', error);
            throw error;
        }
    }

    /**
     * Export conversation to Markdown format
     */
    async exportToMarkdown(sessionData) {
        try {
            const { sessionId, messages, metadata } = sessionData;
            const filename = `conversation_${sessionId}_${Date.now()}.md`;
            const filepath = path.join(this.exportDir, filename);

            let markdown = `# Conversation Export\n\n`;
            markdown += `**Session ID:** ${sessionId}\n`;
            markdown += `**Date:** ${new Date().toISOString()}\n`;
            markdown += `**Messages:** ${messages.length}\n\n`;

            if (metadata.title) {
                markdown += `## ${metadata.title}\n\n`;
            }

            markdown += `---\n\n`;

            // Add messages
            messages.forEach(msg => {
                const timestamp = new Date(msg.created_at).toLocaleString();
                const sender = msg.message_type === 'user' ? '👤 User' : '🤖 Assistant';
                
                markdown += `### ${sender} - ${timestamp}\n\n`;
                markdown += `${msg.content}\n\n`;
                
                if (msg.metadata && Object.keys(msg.metadata).length > 0) {
                    markdown += `<details>\n<summary>Metadata</summary>\n\n`;
                    markdown += '```json\n';
                    markdown += JSON.stringify(msg.metadata, null, 2);
                    markdown += '\n```\n</details>\n\n';
                }
                
                markdown += `---\n\n`;
            });

            await fs.writeFile(filepath, markdown);

            logger.info('Exported conversation to Markdown', { sessionId, filename });

            return {
                success: true,
                filename,
                filepath,
                format: 'markdown',
                size: (await fs.stat(filepath)).size
            };
        } catch (error) {
            logger.error('Markdown export failed:', error);
            throw error;
        }
    }

    /**
     * Export conversation to PDF format
     */
    async exportToPDF(sessionData) {
        try {
            const { sessionId, messages, metadata } = sessionData;
            const filename = `conversation_${sessionId}_${Date.now()}.pdf`;
            const filepath = path.join(this.exportDir, filename);

            // First create markdown
            const markdownResult = await this.exportToMarkdown(sessionData);
            const markdownPath = markdownResult.filepath;

            // Convert markdown to PDF
            return new Promise((resolve, reject) => {
                markdownPdf()
                    .from(markdownPath)
                    .to(filepath, async () => {
                        try {
                            // Clean up markdown file
                            await fs.unlink(markdownPath);

                            const stats = await fs.stat(filepath);
                            logger.info('Exported conversation to PDF', { sessionId, filename });

                            resolve({
                                success: true,
                                filename,
                                filepath,
                                format: 'pdf',
                                size: stats.size
                            });
                        } catch (error) {
                            reject(error);
                        }
                    });
            });
        } catch (error) {
            logger.error('PDF export failed:', error);
            throw error;
        }
    }

    /**
     * Export conversation to PDF using PDFKit (alternative method)
     */
    async exportToPDFKit(sessionData) {
        try {
            const { sessionId, messages, metadata } = sessionData;
            const filename = `conversation_${sessionId}_${Date.now()}.pdf`;
            const filepath = path.join(this.exportDir, filename);

            // Create PDF document
            const doc = new PDFDocument({
                margins: { top: 50, bottom: 50, left: 50, right: 50 }
            });

            // Stream to file
            const stream = doc.pipe(require('fs').createWriteStream(filepath));

            // Title
            doc.fontSize(20).text('Conversation Export', { align: 'center' });
            doc.moveDown();

            // Metadata
            doc.fontSize(12)
                .text(`Session ID: ${sessionId}`)
                .text(`Date: ${new Date().toISOString()}`)
                .text(`Messages: ${messages.length}`);

            if (metadata.title) {
                doc.moveDown().fontSize(16).text(metadata.title);
            }

            doc.moveDown();

            // Messages
            messages.forEach((msg, index) => {
                if (index > 0) doc.moveDown();

                const timestamp = new Date(msg.created_at).toLocaleString();
                const sender = msg.message_type === 'user' ? 'User' : 'Assistant';
                
                // Message header
                doc.fontSize(10)
                    .fillColor('#666')
                    .text(`${sender} - ${timestamp}`);
                
                // Message content
                doc.fontSize(12)
                    .fillColor('#000')
                    .text(msg.content, {
                        width: 500,
                        align: 'justify'
                    });

                // Add separator
                if (index < messages.length - 1) {
                    doc.moveDown()
                        .strokeColor('#ccc')
                        .lineWidth(0.5)
                        .moveTo(50, doc.y)
                        .lineTo(550, doc.y)
                        .stroke();
                }
            });

            // Footer
            doc.fontSize(8)
                .fillColor('#666')
                .text('Generated by Enhanced ReAct Agent', 50, doc.page.height - 50, {
                    align: 'center'
                });

            // Finalize PDF
            doc.end();

            return new Promise((resolve, reject) => {
                stream.on('finish', async () => {
                    try {
                        const stats = await fs.stat(filepath);
                        logger.info('Exported conversation to PDF (PDFKit)', { sessionId, filename });

                        resolve({
                            success: true,
                            filename,
                            filepath,
                            format: 'pdf',
                            size: stats.size
                        });
                    } catch (error) {
                        reject(error);
                    }
                });

                stream.on('error', reject);
            });
        } catch (error) {
            logger.error('PDFKit export failed:', error);
            throw error;
        }
    }

    /**
     * Export conversation summary
     */
    async exportSummary(sessionData) {
        try {
            const { sessionId, messages, metadata } = sessionData;
            const filename = `summary_${sessionId}_${Date.now()}.json`;
            const filepath = path.join(this.exportDir, filename);

            // Calculate statistics
            const userMessages = messages.filter(m => m.message_type === 'user');
            const assistantMessages = messages.filter(m => m.message_type === 'assistant');
            
            const tools = new Set();
            const topics = new Set();
            
            // Extract tools and topics from messages
            messages.forEach(msg => {
                if (msg.metadata) {
                    if (msg.metadata.tools_used) {
                        msg.metadata.tools_used.forEach(tool => tools.add(tool));
                    }
                    if (msg.metadata.topics) {
                        msg.metadata.topics.forEach(topic => topics.add(topic));
                    }
                }
            });

            const summary = {
                sessionId,
                exportDate: new Date().toISOString(),
                statistics: {
                    totalMessages: messages.length,
                    userMessages: userMessages.length,
                    assistantMessages: assistantMessages.length,
                    duration: this.calculateDuration(messages),
                    averageResponseTime: this.calculateAverageResponseTime(messages)
                },
                toolsUsed: Array.from(tools),
                topics: Array.from(topics),
                metadata
            };

            await fs.writeFile(filepath, JSON.stringify(summary, null, 2));

            logger.info('Exported conversation summary', { sessionId, filename });

            return {
                success: true,
                filename,
                filepath,
                format: 'summary',
                size: (await fs.stat(filepath)).size
            };
        } catch (error) {
            logger.error('Summary export failed:', error);
            throw error;
        }
    }

    /**
     * Get export file
     */
    async getExportFile(filename) {
        try {
            const filepath = path.join(this.exportDir, filename);
            const exists = await fs.access(filepath).then(() => true).catch(() => false);
            
            if (!exists) {
                return null;
            }

            const stats = await fs.stat(filepath);
            const content = await fs.readFile(filepath);

            return {
                filename,
                size: stats.size,
                content,
                mimeType: this.getMimeType(filename)
            };
        } catch (error) {
            logger.error('Failed to get export file:', error);
            throw error;
        }
    }

    /**
     * List available exports
     */
    async listExports(sessionId = null) {
        try {
            const files = await fs.readdir(this.exportDir);
            const exports = [];

            for (const file of files) {
                if (sessionId && !file.includes(sessionId)) {
                    continue;
                }

                const filepath = path.join(this.exportDir, file);
                const stats = await fs.stat(filepath);

                exports.push({
                    filename: file,
                    size: stats.size,
                    created: stats.birthtime,
                    format: this.getFormatFromFilename(file)
                });
            }

            return exports.sort((a, b) => b.created - a.created);
        } catch (error) {
            logger.error('Failed to list exports:', error);
            throw error;
        }
    }

    /**
     * Clean old exports
     */
    async cleanOldExports(daysToKeep = 7) {
        try {
            const files = await fs.readdir(this.exportDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            let deletedCount = 0;

            for (const file of files) {
                const filepath = path.join(this.exportDir, file);
                const stats = await fs.stat(filepath);

                if (stats.birthtime < cutoffDate) {
                    await fs.unlink(filepath);
                    deletedCount++;
                }
            }

            logger.info(`Cleaned ${deletedCount} old export files`);
            return deletedCount;
        } catch (error) {
            logger.error('Failed to clean old exports:', error);
            throw error;
        }
    }

    // Helper methods
    calculateDuration(messages) {
        if (messages.length < 2) return 0;
        
        const first = new Date(messages[0].created_at);
        const last = new Date(messages[messages.length - 1].created_at);
        
        return Math.round((last - first) / 1000 / 60); // minutes
    }

    calculateAverageResponseTime(messages) {
        const responseTimes = [];
        
        for (let i = 1; i < messages.length; i++) {
            if (messages[i].message_type === 'assistant' && messages[i-1].message_type === 'user') {
                const userTime = new Date(messages[i-1].created_at);
                const assistantTime = new Date(messages[i].created_at);
                responseTimes.push((assistantTime - userTime) / 1000); // seconds
            }
        }

        if (responseTimes.length === 0) return 0;
        
        const avg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        return Math.round(avg * 10) / 10; // round to 1 decimal
    }

    getFormatFromFilename(filename) {
        const ext = path.extname(filename).toLowerCase();
        switch (ext) {
            case '.json': return filename.includes('summary') ? 'summary' : 'json';
            case '.md': return 'markdown';
            case '.pdf': return 'pdf';
            default: return 'unknown';
        }
    }

    getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        switch (ext) {
            case '.json': return 'application/json';
            case '.md': return 'text/markdown';
            case '.pdf': return 'application/pdf';
            default: return 'application/octet-stream';
        }
    }
}

module.exports = new ExportService();