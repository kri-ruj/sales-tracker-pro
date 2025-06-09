class InsuranceSalesApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.isLiffReady = false;
        this.accessToken = null;
        this.userProfile = null;
        this.agentData = null;
        
        this.initializeApp();
    }

    async initializeApp() {
        try {
            await this.initLiff();
            this.setupEventListeners();
            this.showPage('dashboard');
            await this.loadDashboardData();
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('ไม่สามารถเริ่มต้นแอปได้ กรุณาลองใหม่อีกครั้ง');
        }
    }

    async initLiff() {
        try {
            console.log('Initializing LIFF with ID:', CONFIG.liffId);
            
            await liff.init({
                liffId: CONFIG.liffId
            });

            this.isLiffReady = true;
            console.log('LIFF initialized successfully');

            if (!liff.isLoggedIn()) {
                console.log('User not logged in, redirecting to login');
                liff.login();
                return;
            }

            this.accessToken = liff.getAccessToken();
            this.userProfile = await liff.getProfile();
            
            // Get or create agent profile
            await this.initializeAgent();
            
            console.log('User logged in:', this.userProfile.displayName);
            
        } catch (error) {
            console.error('LIFF initialization failed:', error);
            throw new Error('ไม่สามารถเชื่อมต่อกับ LINE ได้');
        }
    }

    async initializeAgent() {
        try {
            // Try to get existing agent
            let response = await fetch(`${CONFIG.apiBaseUrl}/auth/profile/${this.userProfile.userId}`);
            
            if (response.ok) {
                const data = await response.json();
                this.agentData = data.agent;
            } else {
                // Register new agent
                const context = liff.getContext();
                const teamId = context?.groupId || null;
                
                response = await fetch(`${CONFIG.apiBaseUrl}/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    body: JSON.stringify({
                        lineUserId: this.userProfile.userId,
                        displayName: this.userProfile.displayName,
                        teamId: teamId
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    this.agentData = data.agent;
                } else {
                    throw new Error('Failed to register agent');
                }
            }
        } catch (error) {
            console.error('Agent initialization error:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('dashboard-nav').addEventListener('click', () => this.showDashboard());
        document.getElementById('sales-nav').addEventListener('click', () => this.showSalesPage());
        document.getElementById('add-sale-nav').addEventListener('click', () => this.showAddSalePage());
        document.getElementById('stats-nav').addEventListener('click', () => this.showStatsPage());

        // Forms
        document.getElementById('sale-form').addEventListener('submit', (e) => this.handleSaleSubmit(e));
        document.getElementById('refresh-btn').addEventListener('click', () => this.loadDashboardData());

        // Modal
        document.getElementById('error-ok').addEventListener('click', () => this.hideError());
    }

    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
        }

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
        });
        document.getElementById(`${pageId}-nav`)?.classList.add('active');
    }

    async showDashboard() {
        this.showPage('dashboard');
        await this.loadDashboardData();
    }

    async showSalesPage() {
        this.showPage('sales');
        await this.loadSalesData();
    }

    showAddSalePage() {
        this.showPage('add-sale');
        this.resetSaleForm();
    }

    async showStatsPage() {
        this.showPage('stats');
        await this.loadStatsData();
    }

    async loadDashboardData() {
        try {
            this.showLoading();
            
            const today = new Date().toISOString().split('T')[0];
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            
            // Load dashboard stats
            const [statsResponse, topPerformersResponse] = await Promise.all([
                fetch(`${CONFIG.apiBaseUrl}/dashboard/stats?teamId=${this.agentData?.team_id || ''}&startDate=${startOfMonth}`),
                fetch(`${CONFIG.apiBaseUrl}/dashboard/top-performers?teamId=${this.agentData?.team_id || ''}&limit=5&startDate=${startOfMonth}`)
            ]);

            if (statsResponse.ok && topPerformersResponse.ok) {
                const statsData = await statsResponse.json();
                const performersData = await topPerformersResponse.json();
                
                this.renderDashboard(statsData.stats, performersData.performers);
            }
            
        } catch (error) {
            console.error('Dashboard load error:', error);
            this.showError('ไม่สามารถโหลดข้อมูลแดชบอร์ดได้');
        } finally {
            this.hideLoading();
        }
    }

    renderDashboard(stats, performers) {
        // Update stats cards
        document.getElementById('total-sales').textContent = stats.total_sales || 0;
        document.getElementById('total-premium').textContent = this.formatCurrency(stats.total_premium || 0);
        document.getElementById('total-commission').textContent = this.formatCurrency(stats.total_commission || 0);
        document.getElementById('active-agents').textContent = stats.active_agents || 0;

        // Update top performers
        const performersList = document.getElementById('top-performers-list');
        performersList.innerHTML = performers.map((performer, index) => {
            const rank = index + 1;
            const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🏅';
            
            return `
                <div class="performer-item">
                    <div class="performer-rank">${emoji} ${rank}</div>
                    <div class="performer-info">
                        <div class="performer-name">${performer.display_name}</div>
                        <div class="performer-stats">
                            ${performer.sales_count || 0} สัญญา • ${this.formatCurrency(performer.total_premium || 0)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async loadSalesData() {
        try {
            this.showLoading();
            
            const response = await fetch(`${CONFIG.apiBaseUrl}/sales?agentId=${this.agentData?.id || ''}`);
            
            if (response.ok) {
                const data = await response.json();
                this.renderSalesList(data.sales);
            }
            
        } catch (error) {
            console.error('Sales load error:', error);
            this.showError('ไม่สามารถโหลดข้อมูลการขายได้');
        } finally {
            this.hideLoading();
        }
    }

    renderSalesList(sales) {
        const salesList = document.getElementById('sales-list');
        
        if (!sales || sales.length === 0) {
            salesList.innerHTML = '<div class="empty-state">ยังไม่มีข้อมูลการขาย</div>';
            return;
        }
        
        salesList.innerHTML = sales.map(sale => `
            <div class="sale-item">
                <div class="sale-header">
                    <div class="sale-customer">${sale.customer_name}</div>
                    <div class="sale-date">${this.formatDate(sale.sale_date)}</div>
                </div>
                <div class="sale-details">
                    <div class="sale-policy">${sale.policy_type}</div>
                    <div class="sale-amount">${this.formatCurrency(sale.premium_amount)}</div>
                </div>
                <div class="sale-commission">คอมมิชชั่น: ${this.formatCurrency(sale.commission_amount || 0)}</div>
            </div>
        `).join('');
    }

    async loadStatsData() {
        try {
            this.showLoading();
            
            const today = new Date().toISOString().split('T')[0];
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            
            const [todayResponse, monthResponse] = await Promise.all([
                fetch(`${CONFIG.apiBaseUrl}/sales?agentId=${this.agentData?.id}&startDate=${today}&endDate=${today}`),
                fetch(`${CONFIG.apiBaseUrl}/sales?agentId=${this.agentData?.id}&startDate=${startOfMonth}`)
            ]);

            if (todayResponse.ok && monthResponse.ok) {
                const todayData = await todayResponse.json();
                const monthData = await monthResponse.json();
                
                this.renderPersonalStats(todayData.sales, monthData.sales);
            }
            
        } catch (error) {
            console.error('Stats load error:', error);
            this.showError('ไม่สามารถโหลดข้อมูลสถิติได้');
        } finally {
            this.hideLoading();
        }
    }

    renderPersonalStats(todaySales, monthSales) {
        const todayTotal = todaySales.reduce((sum, sale) => sum + parseFloat(sale.premium_amount), 0);
        const todayCommission = todaySales.reduce((sum, sale) => sum + parseFloat(sale.commission_amount || 0), 0);
        
        const monthTotal = monthSales.reduce((sum, sale) => sum + parseFloat(sale.premium_amount), 0);
        const monthCommission = monthSales.reduce((sum, sale) => sum + parseFloat(sale.commission_amount || 0), 0);

        document.getElementById('today-sales-count').textContent = todaySales.length;
        document.getElementById('today-premium').textContent = this.formatCurrency(todayTotal);
        document.getElementById('today-commission').textContent = this.formatCurrency(todayCommission);

        document.getElementById('month-sales-count').textContent = monthSales.length;
        document.getElementById('month-premium').textContent = this.formatCurrency(monthTotal);
        document.getElementById('month-commission').textContent = this.formatCurrency(monthCommission);
    }

    resetSaleForm() {
        document.getElementById('sale-form').reset();
        document.getElementById('sale-date').value = new Date().toISOString().split('T')[0];
    }

    async handleSaleSubmit(e) {
        e.preventDefault();
        
        try {
            this.showLoading();
            
            const formData = new FormData(e.target);
            const saleData = {
                agentId: this.agentData.id,
                customerName: formData.get('customerName'),
                policyType: formData.get('policyType'),
                premiumAmount: parseFloat(formData.get('premiumAmount')),
                commissionAmount: parseFloat(formData.get('commissionAmount')),
                saleDate: formData.get('saleDate'),
                notes: formData.get('notes')
            };

            const response = await fetch(`${CONFIG.apiBaseUrl}/sales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify(saleData)
            });

            if (response.ok) {
                this.showSuccess('บันทึกการขายสำเร็จ!');
                this.resetSaleForm();
                
                // Refresh dashboard data
                if (this.currentPage === 'dashboard') {
                    await this.loadDashboardData();
                }
            } else {
                throw new Error('Failed to save sale');
            }
            
        } catch (error) {
            console.error('Sale submit error:', error);
            this.showError('ไม่สามารถบันทึกการขายได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            this.hideLoading();
        }
    }

    // Utility methods
    formatCurrency(amount) {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            minimumFractionDigits: 0
        }).format(amount);
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-modal').classList.remove('hidden');
    }

    showSuccess(message) {
        document.getElementById('success-message').textContent = message;
        document.getElementById('success-modal').classList.remove('hidden');
        
        setTimeout(() => {
            document.getElementById('success-modal').classList.add('hidden');
        }, 3000);
    }

    hideError() {
        document.getElementById('error-modal').classList.add('hidden');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InsuranceSalesApp();
});