#!/usr/bin/env node

/**
 * Email Integration Setup Script
 * Helps configure email providers for the AI service
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

async function setupEmail() {
    console.log('\n🚀 Email Integration Setup for AI Service\n');
    
    // Check if .env exists
    const envPath = path.join(__dirname, '../../../.env');
    let envContent = '';
    
    try {
        envContent = await fs.readFile(envPath, 'utf-8');
        console.log('✓ Found existing .env file\n');
    } catch {
        console.log('📝 Creating new .env file\n');
    }
    
    // Select default provider
    console.log('Available email providers:');
    console.log('1. SMTP (Universal - Recommended)');
    console.log('2. Gmail (OAuth2)');
    console.log('3. Outlook (Microsoft Graph)');
    
    const providerChoice = await question('\nSelect default provider (1-3): ');
    
    let defaultProvider = 'smtp';
    switch (providerChoice) {
        case '2':
            defaultProvider = 'gmail';
            break;
        case '3':
            defaultProvider = 'outlook';
            break;
    }
    
    envContent = updateEnvVar(envContent, 'DEFAULT_EMAIL_PROVIDER', defaultProvider);
    
    // Configure selected provider
    if (defaultProvider === 'smtp' || providerChoice === '1') {
        await configureSMTP(envContent, envPath);
    }
    
    if (defaultProvider === 'gmail' || providerChoice === '2') {
        await configureGmail(envContent, envPath);
    }
    
    if (defaultProvider === 'outlook' || providerChoice === '3') {
        await configureOutlook(envContent, envPath);
    }
    
    // Test email
    const testEmail = await question('\nEnter test email address (optional): ');
    if (testEmail) {
        envContent = updateEnvVar(envContent, 'TEST_EMAIL', testEmail);
    }
    
    // Save .env file
    await fs.writeFile(envPath, envContent);
    console.log('\n✓ Configuration saved to .env file');
    
    // Install dependencies
    console.log('\n📦 Installing required dependencies...');
    await installDependencies();
    
    // Test connection
    const testConnection = await question('\nTest email connection? (y/n): ');
    if (testConnection.toLowerCase() === 'y') {
        await testEmailConnection();
    }
    
    console.log('\n✅ Email integration setup complete!');
    console.log('\nNext steps:');
    console.log('1. Review the .env file for accuracy');
    console.log('2. Run test examples: node test-examples.js');
    console.log('3. Import email service in your code:');
    console.log('   const emailService = require("./services/email.service");');
    
    rl.close();
}

async function configureSMTP(envContent, envPath) {
    console.log('\n📧 Configuring SMTP...\n');
    
    console.log('Common SMTP providers:');
    console.log('1. Gmail (smtp.gmail.com:587)');
    console.log('2. Outlook (smtp-mail.outlook.com:587)');
    console.log('3. Yahoo (smtp.mail.yahoo.com:465)');
    console.log('4. SendGrid (smtp.sendgrid.net:587)');
    console.log('5. Custom SMTP server');
    
    const smtpChoice = await question('\nSelect SMTP provider (1-5): ');
    
    let host, port, secure;
    
    switch (smtpChoice) {
        case '1':
            host = 'smtp.gmail.com';
            port = '587';
            secure = 'false';
            console.log('\n⚠️  Gmail requires an App Password, not your regular password');
            console.log('Generate one at: https://myaccount.google.com/apppasswords');
            break;
        case '2':
            host = 'smtp-mail.outlook.com';
            port = '587';
            secure = 'false';
            break;
        case '3':
            host = 'smtp.mail.yahoo.com';
            port = '465';
            secure = 'true';
            break;
        case '4':
            host = 'smtp.sendgrid.net';
            port = '587';
            secure = 'false';
            console.log('\n⚠️  Use "apikey" as username and your API key as password');
            break;
        default:
            host = await question('SMTP Host: ');
            port = await question('SMTP Port: ');
            secure = await question('Use SSL/TLS? (true/false): ');
    }
    
    const user = await question('SMTP Username/Email: ');
    const pass = await question('SMTP Password/App Password: ');
    const fromEmail = await question('Default From Email (optional): ') || user;
    
    envContent = updateEnvVar(envContent, 'SMTP_HOST', host);
    envContent = updateEnvVar(envContent, 'SMTP_PORT', port);
    envContent = updateEnvVar(envContent, 'SMTP_SECURE', secure);
    envContent = updateEnvVar(envContent, 'SMTP_USER', user);
    envContent = updateEnvVar(envContent, 'SMTP_PASS', pass);
    envContent = updateEnvVar(envContent, 'SMTP_FROM_EMAIL', fromEmail);
    
    await fs.writeFile(envPath, envContent);
    console.log('\n✓ SMTP configuration saved');
}

async function configureGmail(envContent, envPath) {
    console.log('\n📧 Configuring Gmail OAuth2...\n');
    
    console.log('To use Gmail API, you need to:');
    console.log('1. Go to https://console.cloud.google.com');
    console.log('2. Create a new project or select existing');
    console.log('3. Enable Gmail API');
    console.log('4. Create OAuth2 credentials');
    console.log('5. Download credentials.json');
    
    const credentialsPath = await question('\nPath to Gmail credentials.json: ');
    
    // Create credentials directory
    const credDir = path.join(__dirname, '../../../credentials');
    try {
        await fs.mkdir(credDir, { recursive: true });
    } catch {}
    
    // Copy credentials file
    try {
        const destPath = path.join(credDir, 'gmail-credentials.json');
        await fs.copyFile(credentialsPath, destPath);
        
        envContent = updateEnvVar(envContent, 'GMAIL_ENABLED', 'true');
        envContent = updateEnvVar(envContent, 'GOOGLE_GMAIL_CREDENTIALS', './credentials/gmail-credentials.json');
        envContent = updateEnvVar(envContent, 'GOOGLE_GMAIL_TOKEN', './credentials/gmail-token.json');
        
        await fs.writeFile(envPath, envContent);
        console.log('\n✓ Gmail configuration saved');
    } catch (error) {
        console.error('\n✗ Failed to copy credentials:', error.message);
    }
}

async function configureOutlook(envContent, envPath) {
    console.log('\n📧 Configuring Microsoft Outlook...\n');
    
    console.log('To use Microsoft Graph API, you need to:');
    console.log('1. Go to https://portal.azure.com');
    console.log('2. Register a new app in Azure AD');
    console.log('3. Add Mail.Send and Mail.Read permissions');
    console.log('4. Create a client secret');
    
    const clientId = await question('\nAzure App Client ID: ');
    const clientSecret = await question('Azure App Client Secret: ');
    const tenantId = await question('Tenant ID (or "common"): ') || 'common';
    
    envContent = updateEnvVar(envContent, 'OUTLOOK_ENABLED', 'true');
    envContent = updateEnvVar(envContent, 'OUTLOOK_CLIENT_ID', clientId);
    envContent = updateEnvVar(envContent, 'OUTLOOK_CLIENT_SECRET', clientSecret);
    envContent = updateEnvVar(envContent, 'OUTLOOK_TENANT_ID', tenantId);
    
    await fs.writeFile(envPath, envContent);
    console.log('\n✓ Outlook configuration saved');
}

function updateEnvVar(content, key, value) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const newLine = `${key}=${value}`;
    
    if (regex.test(content)) {
        return content.replace(regex, newLine);
    } else {
        return content + (content.endsWith('\n') ? '' : '\n') + newLine + '\n';
    }
}

async function installDependencies() {
    const dependencies = [
        'nodemailer',
        '@microsoft/microsoft-graph-client',
        '@azure/msal-node',
        'googleapis',
        '@google-cloud/local-auth'
    ];
    
    console.log('Installing:', dependencies.join(', '));
    
    try {
        execSync(`npm install ${dependencies.join(' ')}`, {
            cwd: path.join(__dirname, '../../..'),
            stdio: 'inherit'
        });
        console.log('\n✓ Dependencies installed');
    } catch (error) {
        console.error('\n✗ Failed to install dependencies:', error.message);
        console.log('Please run manually: npm install', dependencies.join(' '));
    }
}

async function testEmailConnection() {
    console.log('\n🧪 Testing email connection...\n');
    
    try {
        const emailService = require('../../services/email.service');
        await emailService.initialize();
        
        const providers = emailService.getAvailableProviders();
        console.log('Available providers:', providers.providers);
        
        for (const provider of providers.providers) {
            const result = await emailService.verifyConnection(provider);
            if (result.success) {
                console.log(`✓ ${provider}: ${result.summary}`);
            } else {
                console.log(`✗ ${provider}: ${result.summary}`);
            }
        }
    } catch (error) {
        console.error('✗ Connection test failed:', error.message);
    }
}

// Run setup
if (require.main === module) {
    setupEmail().catch(console.error);
}