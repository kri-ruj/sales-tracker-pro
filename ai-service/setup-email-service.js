#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

console.log('\n=== Enhanced Email Service Setup ===\n');

async function setup() {
    try {
        const config = {
            // Email Provider Settings
            DEFAULT_EMAIL_PROVIDER: 'smtp',
            DEFAULT_FROM_EMAIL: '',
            
            // SMTP Settings
            SMTP_HOST: '',
            SMTP_PORT: '587',
            SMTP_SECURE: 'false',
            SMTP_USER: '',
            SMTP_PASS: '',
            
            // Gmail Settings
            GMAIL_USER: '',
            GMAIL_APP_PASSWORD: '',
            
            // SendGrid Settings
            SENDGRID_API_KEY: '',
            
            // AWS SES Settings
            AWS_ACCESS_KEY_ID: '',
            AWS_SECRET_ACCESS_KEY: '',
            AWS_REGION: 'us-east-1',
            SES_CONFIGURATION_SET: '',
            
            // Email Tracking
            EMAIL_TRACKING_ENDPOINT: '',
            APP_URL: '',
            
            // Security
            UNSUBSCRIBE_SECRET: crypto.randomBytes(32).toString('hex'),
            
            // Testing
            TEST_EMAIL: ''
        };
        
        console.log('Which email provider would you like to use as default?');
        console.log('1. SMTP (Gmail, Outlook, Custom)');
        console.log('2. SendGrid');
        console.log('3. AWS SES');
        
        const providerChoice = await question('Enter choice (1-3): ');
        
        switch (providerChoice) {
            case '1':
                config.DEFAULT_EMAIL_PROVIDER = 'smtp';
                console.log('\nConfiguring SMTP...');
                
                const smtpChoice = await question('Use preset? (1=Gmail, 2=Outlook, 3=Custom): ');
                
                if (smtpChoice === '1') {
                    config.SMTP_HOST = 'smtp.gmail.com';
                    config.SMTP_PORT = '587';
                    config.SMTP_SECURE = 'false';
                    config.GMAIL_USER = await question('Gmail address: ');
                    config.GMAIL_APP_PASSWORD = await question('Gmail app password: ');
                    config.SMTP_USER = config.GMAIL_USER;
                    config.SMTP_PASS = config.GMAIL_APP_PASSWORD;
                } else if (smtpChoice === '2') {
                    config.SMTP_HOST = 'smtp-mail.outlook.com';
                    config.SMTP_PORT = '587';
                    config.SMTP_SECURE = 'false';
                    config.SMTP_USER = await question('Outlook email: ');
                    config.SMTP_PASS = await question('Outlook password: ');
                } else {
                    config.SMTP_HOST = await question('SMTP host: ');
                    config.SMTP_PORT = await question('SMTP port (587): ') || '587';
                    config.SMTP_SECURE = await question('Use TLS? (y/n): ') === 'y' ? 'true' : 'false';
                    config.SMTP_USER = await question('SMTP username: ');
                    config.SMTP_PASS = await question('SMTP password: ');
                }
                break;
                
            case '2':
                config.DEFAULT_EMAIL_PROVIDER = 'sendgrid';
                console.log('\nConfiguring SendGrid...');
                config.SENDGRID_API_KEY = await question('SendGrid API key: ');
                break;
                
            case '3':
                config.DEFAULT_EMAIL_PROVIDER = 'ses';
                console.log('\nConfiguring AWS SES...');
                config.AWS_ACCESS_KEY_ID = await question('AWS Access Key ID: ');
                config.AWS_SECRET_ACCESS_KEY = await question('AWS Secret Access Key: ');
                config.AWS_REGION = await question('AWS Region (us-east-1): ') || 'us-east-1';
                config.SES_CONFIGURATION_SET = await question('SES Configuration Set (optional): ');
                break;
        }
        
        // Common settings
        console.log('\nCommon Settings:');
        config.DEFAULT_FROM_EMAIL = await question('Default FROM email address: ');
        config.APP_URL = await question('Application URL (for unsubscribe links): ');
        config.EMAIL_TRACKING_ENDPOINT = config.APP_URL + '/track';
        config.TEST_EMAIL = await question('Test email address (for testing): ');
        
        // Optional providers
        if (await question('\nConfigure additional providers? (y/n): ') === 'y') {
            if (config.DEFAULT_EMAIL_PROVIDER !== 'gmail' && await question('Configure Gmail? (y/n): ') === 'y') {
                config.GMAIL_USER = await question('Gmail address: ');
                config.GMAIL_APP_PASSWORD = await question('Gmail app password: ');
            }
            
            if (config.DEFAULT_EMAIL_PROVIDER !== 'sendgrid' && await question('Configure SendGrid? (y/n): ') === 'y') {
                config.SENDGRID_API_KEY = await question('SendGrid API key: ');
            }
            
            if (config.DEFAULT_EMAIL_PROVIDER !== 'ses' && await question('Configure AWS SES? (y/n): ') === 'y') {
                config.AWS_ACCESS_KEY_ID = await question('AWS Access Key ID: ');
                config.AWS_SECRET_ACCESS_KEY = await question('AWS Secret Access Key: ');
                config.AWS_REGION = await question('AWS Region (us-east-1): ') || 'us-east-1';
            }
        }
        
        // Generate .env content
        const envContent = Object.entries(config)
            .filter(([key, value]) => value)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        
        // Check if .env exists
        const envPath = path.join(__dirname, '.env');
        let existingEnv = '';
        
        try {
            existingEnv = await fs.readFile(envPath, 'utf8');
        } catch (error) {
            // .env doesn't exist
        }
        
        if (existingEnv) {
            console.log('\n.env file already exists.');
            const action = await question('1. Append email config\n2. Create .env.email\n3. Cancel\nChoice: ');
            
            if (action === '1') {
                await fs.writeFile(envPath, existingEnv + '\n\n# Email Configuration\n' + envContent);
                console.log('\nEmail configuration appended to .env');
            } else if (action === '2') {
                await fs.writeFile(path.join(__dirname, '.env.email'), envContent);
                console.log('\nEmail configuration saved to .env.email');
                console.log('Copy the contents to your main .env file');
            } else {
                console.log('\nSetup cancelled');
            }
        } else {
            await fs.writeFile(envPath, envContent);
            console.log('\n.env file created with email configuration');
        }
        
        // Create email templates directory
        const templatesDir = path.join(__dirname, 'templates', 'emails');
        await fs.mkdir(templatesDir, { recursive: true });
        console.log(`\nEmail templates directory created at: ${templatesDir}`);
        
        console.log('\n=== Setup Complete ===');
        console.log('\nNext steps:');
        console.log('1. Review and update .env file if needed');
        console.log('2. Run: npm run start:email');
        console.log('3. Access email admin at: http://localhost:3000/admin/email');
        console.log('4. Send a test email to verify configuration');
        
        // Gmail specific instructions
        if (config.GMAIL_USER) {
            console.log('\n=== Gmail Setup ===');
            console.log('1. Enable 2-factor authentication on your Google account');
            console.log('2. Generate an app password: https://myaccount.google.com/apppasswords');
            console.log('3. Use the app password instead of your regular password');
        }
        
        // SendGrid specific instructions
        if (config.SENDGRID_API_KEY) {
            console.log('\n=== SendGrid Setup ===');
            console.log('1. Verify your sender email in SendGrid');
            console.log('2. Configure domain authentication for better deliverability');
        }
        
        // AWS SES specific instructions
        if (config.AWS_ACCESS_KEY_ID) {
            console.log('\n=== AWS SES Setup ===');
            console.log('1. Verify your sender email/domain in AWS SES');
            console.log('2. Request production access to send to any email');
            console.log('3. Configure SNS for bounce/complaint handling');
        }
        
    } catch (error) {
        console.error('\nSetup error:', error.message);
    } finally {
        rl.close();
    }
}

setup();