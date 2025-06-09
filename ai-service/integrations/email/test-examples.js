/**
 * Email Integration Test Examples
 * Demonstrates common use cases for all email providers
 */

const GmailIntegration = require('./gmail.integration');
const OutlookIntegration = require('./outlook.integration');
const SMTPIntegration = require('./smtp.integration');
const emailService = require('../../services/email.service');

// Test configuration
const TEST_CONFIG = {
    testEmail: process.env.TEST_EMAIL || 'test@example.com',
    mockMode: process.env.NODE_ENV === 'development'
};

/**
 * Example 1: Basic Email Sending
 */
async function testBasicEmail() {
    console.log('\n=== Test 1: Basic Email Sending ===');
    
    try {
        // Using unified service (recommended)
        const result = await emailService.sendEmail({
            to: TEST_CONFIG.testEmail,
            subject: 'Test Email from AI Service',
            html: `
                <h1>Hello from AI Service!</h1>
                <p>This is a test email sent at ${new Date().toISOString()}</p>
                <p>Provider: ${emailService.defaultProvider}</p>
            `
        });
        
        console.log('✓ Email sent successfully:', result);
    } catch (error) {
        console.error('✗ Failed to send email:', error.message);
    }
}

/**
 * Example 2: Email with Attachments
 */
async function testEmailWithAttachments() {
    console.log('\n=== Test 2: Email with Attachments ===');
    
    try {
        const result = await emailService.sendEmail({
            to: TEST_CONFIG.testEmail,
            subject: 'Email with Attachments',
            html: '<p>Please find the attached files.</p>',
            attachments: [
                {
                    filename: 'test.txt',
                    content: Buffer.from('Hello World!').toString('base64')
                },
                {
                    filename: 'report.json',
                    content: Buffer.from(JSON.stringify({ test: true }, null, 2)).toString('base64'),
                    contentType: 'application/json'
                }
            ]
        });
        
        console.log('✓ Email with attachments sent:', result);
    } catch (error) {
        console.error('✗ Failed to send email with attachments:', error.message);
    }
}

/**
 * Example 3: Bulk Email Sending
 */
async function testBulkEmails() {
    console.log('\n=== Test 3: Bulk Email Sending ===');
    
    const emails = [
        {
            to: 'user1@example.com',
            subject: 'Newsletter #1',
            html: '<h1>Welcome to our newsletter!</h1>'
        },
        {
            to: 'user2@example.com',
            subject: 'Newsletter #1',
            html: '<h1>Welcome to our newsletter!</h1>'
        },
        {
            to: 'user3@example.com',
            subject: 'Newsletter #1',
            html: '<h1>Welcome to our newsletter!</h1>'
        }
    ];
    
    try {
        const result = await emailService.sendBulkEmails(emails);
        console.log('✓ Bulk emails sent:', result);
    } catch (error) {
        console.error('✗ Failed to send bulk emails:', error.message);
    }
}

/**
 * Example 4: Template Email
 */
async function testTemplateEmail() {
    console.log('\n=== Test 4: Template Email ===');
    
    try {
        const result = await emailService.sendTemplateEmail(
            'welcome',
            {
                name: 'John Doe',
                company: 'Acme Corporation'
            },
            {
                to: TEST_CONFIG.testEmail
            }
        );
        
        console.log('✓ Template email sent:', result);
    } catch (error) {
        console.error('✗ Failed to send template email:', error.message);
    }
}

/**
 * Example 5: Gmail-specific Features
 */
async function testGmailFeatures() {
    console.log('\n=== Test 5: Gmail-specific Features ===');
    
    const gmail = new GmailIntegration();
    
    try {
        // Create a draft
        const draftResult = await gmail.run({
            operation: 'createDraft',
            emailData: {
                to: TEST_CONFIG.testEmail,
                subject: 'Gmail Draft Test',
                body: 'This is a draft email created via Gmail API'
            }
        });
        
        console.log('✓ Gmail draft created:', draftResult);
        
        // Search emails
        const searchResult = await gmail.run({
            operation: 'searchEmails',
            searchQuery: 'subject:test',
            maxResults: 5
        });
        
        console.log('✓ Gmail search results:', searchResult);
    } catch (error) {
        console.error('✗ Gmail operations failed:', error.message);
    }
}

/**
 * Example 6: Outlook-specific Features
 */
async function testOutlookFeatures() {
    console.log('\n=== Test 6: Outlook-specific Features ===');
    
    const outlook = new OutlookIntegration();
    
    try {
        // Send with high importance and categories
        const emailResult = await outlook.run({
            operation: 'sendEmail',
            emailData: {
                to: [TEST_CONFIG.testEmail],
                subject: 'Important: Outlook Test',
                body: '<p>This is a high-importance email with categories.</p>',
                isHtml: true,
                importance: 'high',
                categories: ['Testing', 'AI Service'],
                requestReadReceipt: true
            }
        });
        
        console.log('✓ Outlook email sent:', emailResult);
        
        // Create a folder
        const folderResult = await outlook.run({
            operation: 'createFolder',
            folderName: 'AI Service Tests'
        });
        
        console.log('✓ Outlook folder created:', folderResult);
        
        // List folders
        const foldersResult = await outlook.run({
            operation: 'listFolders'
        });
        
        console.log('✓ Outlook folders:', foldersResult);
    } catch (error) {
        console.error('✗ Outlook operations failed:', error.message);
    }
}

/**
 * Example 7: SMTP with Different Providers
 */
async function testSMTPProviders() {
    console.log('\n=== Test 7: SMTP with Different Providers ===');
    
    const smtp = new SMTPIntegration();
    
    // Test Gmail SMTP
    try {
        const gmailResult = await smtp.run({
            operation: 'sendEmail',
            provider: 'gmail',
            emailData: {
                to: TEST_CONFIG.testEmail,
                subject: 'SMTP Gmail Test',
                text: 'This email was sent via Gmail SMTP'
            }
        });
        
        console.log('✓ Gmail SMTP sent:', gmailResult);
    } catch (error) {
        console.error('✗ Gmail SMTP failed:', error.message);
    }
    
    // Test custom SMTP
    try {
        const customResult = await smtp.run({
            operation: 'sendEmail',
            smtpConfig: {
                host: 'smtp.mailtrap.io',
                port: 2525,
                auth: {
                    user: 'your-mailtrap-user',
                    pass: 'your-mailtrap-pass'
                }
            },
            emailData: {
                from: 'test@aiservice.com',
                to: TEST_CONFIG.testEmail,
                subject: 'Custom SMTP Test',
                html: '<p>Sent via custom SMTP configuration</p>'
            }
        });
        
        console.log('✓ Custom SMTP sent:', customResult);
    } catch (error) {
        console.error('✗ Custom SMTP failed:', error.message);
    }
}

/**
 * Example 8: Email with Inline Images
 */
async function testInlineImages() {
    console.log('\n=== Test 8: Email with Inline Images ===');
    
    try {
        const result = await emailService.sendEmail({
            to: TEST_CONFIG.testEmail,
            subject: 'Email with Inline Images',
            html: `
                <h1>Check out our logo!</h1>
                <img src="cid:logo123" width="200">
                <p>This image is embedded in the email.</p>
            `,
            attachments: [
                {
                    filename: 'logo.png',
                    content: 'base64-encoded-image-data-here',
                    cid: 'logo123',
                    isInline: true
                }
            ]
        });
        
        console.log('✓ Email with inline images sent:', result);
    } catch (error) {
        console.error('✗ Failed to send email with inline images:', error.message);
    }
}

/**
 * Example 9: Connection Verification
 */
async function testConnectionVerification() {
    console.log('\n=== Test 9: Connection Verification ===');
    
    const providers = ['gmail', 'outlook', 'smtp'];
    
    for (const provider of providers) {
        try {
            const result = await emailService.verifyConnection(provider);
            console.log(`✓ ${provider} connection:`, result);
        } catch (error) {
            console.error(`✗ ${provider} connection failed:`, error.message);
        }
    }
}

/**
 * Example 10: Error Handling and Fallback
 */
async function testErrorHandling() {
    console.log('\n=== Test 10: Error Handling and Fallback ===');
    
    try {
        // Try to send with a non-existent provider
        const result = await emailService.sendEmail({
            to: TEST_CONFIG.testEmail,
            subject: 'Fallback Test',
            text: 'This should fallback to SMTP'
        }, {
            provider: 'non-existent-provider'
        });
        
        console.log('✓ Email sent with fallback:', result);
    } catch (error) {
        console.error('✗ Fallback failed:', error.message);
    }
    
    // Test with disabled fallback
    try {
        await emailService.sendEmail({
            to: TEST_CONFIG.testEmail,
            subject: 'No Fallback Test',
            text: 'This should fail without fallback'
        }, {
            provider: 'non-existent-provider',
            fallback: false
        });
    } catch (error) {
        console.log('✓ Expected error without fallback:', error.message);
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('Starting Email Integration Tests...');
    console.log('Mock Mode:', TEST_CONFIG.mockMode);
    
    // Initialize email service
    await emailService.initialize();
    
    // Show available providers
    const providers = emailService.getAvailableProviders();
    console.log('\nAvailable Providers:', providers);
    
    // Run tests
    await testBasicEmail();
    await testEmailWithAttachments();
    await testBulkEmails();
    await testTemplateEmail();
    await testGmailFeatures();
    await testOutlookFeatures();
    await testSMTPProviders();
    await testInlineImages();
    await testConnectionVerification();
    await testErrorHandling();
    
    console.log('\n=== Tests Complete ===');
}

// Run specific test
async function runTest(testName) {
    await emailService.initialize();
    
    const tests = {
        basic: testBasicEmail,
        attachments: testEmailWithAttachments,
        bulk: testBulkEmails,
        template: testTemplateEmail,
        gmail: testGmailFeatures,
        outlook: testOutlookFeatures,
        smtp: testSMTPProviders,
        inline: testInlineImages,
        connection: testConnectionVerification,
        error: testErrorHandling
    };
    
    if (tests[testName]) {
        await tests[testName]();
    } else {
        console.error(`Unknown test: ${testName}`);
        console.log('Available tests:', Object.keys(tests).join(', '));
    }
}

// Export for use in other modules
module.exports = {
    runAllTests,
    runTest,
    testBasicEmail,
    testEmailWithAttachments,
    testBulkEmails,
    testTemplateEmail,
    testGmailFeatures,
    testOutlookFeatures,
    testSMTPProviders,
    testInlineImages,
    testConnectionVerification,
    testErrorHandling
};

// Run tests if called directly
if (require.main === module) {
    const testName = process.argv[2];
    
    if (testName) {
        runTest(testName).catch(console.error);
    } else {
        runAllTests().catch(console.error);
    }
}