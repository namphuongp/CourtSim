import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, Landmark, ShieldCheck, Sparkles } from 'lucide-react';
import UserHeader from '../../components/UserHeader';
import api, { getApiError } from '../../services/api';
import { findPricingPlan, savedCheckoutPlan } from '../../services/pricingPlans';
import './checkout.css';
import { setCurrentUser } from '../../services/auth';
import { submitGatewayCheckout } from '../../services/payments';

const formatMoney = (amount) => amount ? new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ' : '0 VNĐ';
const statusText = {
  pending: 'Chờ thanh toán',
  processing: 'Đang xác minh',
  paid: 'Đã thanh toán',
  expired: 'Đã hết hạn',
  cancelled: 'Đã hủy',
};

function remaining(expiresAt, now) {
  const ms = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return '00:00';
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function CheckoutPage() {
  const { planId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderCode = searchParams.get('order');
  const returnResult = searchParams.get('payment');
  const [order, setOrder] = useState(null);
  const plan = order ? savedCheckoutPlan(order) : findPricingPlan(planId);
  const [qrMissing, setQrMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [accessSynced, setAccessSynced] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(Boolean(orderCode));

  useEffect(() => {
    if (!orderCode) return;
    const controller = new AbortController();
    api.get(`/payments/${encodeURIComponent(orderCode)}/status`, { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setOrder(data.payment ?? data.data);
    }).catch(err => {
      if (!controller.signal.aborted) setError(getApiError(err, 'Chưa thể tải đơn thanh toán. Hãy tải lại trang để thử lại.'));
    }).finally(() => { if (!controller.signal.aborted) setLoadingOrder(false); });
    return () => controller.abort();
  }, [orderCode]);

  const countdown = order?.expiresAt ? remaining(order.expiresAt, now) : '';
  const paymentId = order?.payment_id ?? order?.id ?? order?.transaction_id;
  const paymentStatus = order?.status;
  useEffect(() => {
    if (order?.status !== 'paid') return;
    const controller = new AbortController();
    api.get('/auth/me', { signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) { setCurrentUser(data.user); setAccessSynced(true); }
    }).catch(() => {}); // Quyền thực tế vẫn do backend kiểm tra ở mỗi yêu cầu.
    return () => controller.abort();
  }, [order?.status]);

  async function createOrder() {
    if (!plan || busy || plan.amount === 0) return;
    setBusy(true);
    setError('');
    setQrMissing(false);
    try {
      const { data } = await api.post('/payments/create', { type: plan.type });
      const created = data.payment ?? data.data;
      setOrder(created);
      setAccessSynced(false);
      setSearchParams({ order: created.orderCode }, { replace: true });
      if (created.checkout) submitGatewayCheckout(created.checkout);
    } catch (err) {
      setError(getApiError(err, 'Chưa thể tạo yêu cầu thanh toán. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  }

  async function continuePayment() {
    if (!order || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/payments/${encodeURIComponent(order.orderCode)}/checkout`);
      submitGatewayCheckout((data.payment ?? data.data).checkout);
    } catch (err) {
      setError(getApiError(err, 'Chưa thể mở cổng thanh toán. Vui lòng kiểm tra trạng thái và thử lại.'));
    } finally { setBusy(false); }
  }

  async function refreshOrder({ silent = false } = {}) {
    if (!order || checking) return;
    if (!silent) setChecking(true);
    setError('');
    try {
      const { data } = await api.get(`/payments/${order.payment_id ?? order.id ?? order.transaction_id}/status`);
      setOrder(data.payment ?? data.data);
    } catch (err) {
      if (!silent) setError(getApiError(err, 'Chưa thể kiểm tra trạng thái thanh toán.'));
    } finally {
      if (!silent) setChecking(false);
    }
  }

  useEffect(() => {
    if (!paymentId || ['paid', 'cancelled'].includes(paymentStatus)) return undefined;
    const controller = new AbortController();
    let inFlight = false;
    const timer = window.setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const { data } = await api.get(`/payments/${paymentId}/status`, { signal: controller.signal });
        if (!controller.signal.aborted) setOrder(data.payment ?? data.data);
      } catch {
        // Keep the current screen while the next poll retries.
      } finally { inFlight = false; }
    }, paymentStatus === 'expired' ? 30000 : 5000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [paymentId, paymentStatus]);

  useEffect(() => {
    if (!order?.expiresAt || ['paid', 'expired', 'cancelled'].includes(order.status)) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [order?.expiresAt, order?.status]);

  if (orderCode && !order) {
    return <div className="user-shell checkout-shell">
      <UserHeader />
      <main className="checkout-page user-content"><section className="checkout-card">
        {loadingOrder ? <p role="status">Đang tải thông tin đơn thanh toán...</p> : <>
          <p role="alert">{error || 'Chưa tải được đơn thanh toán. Hãy thử lại.'}</p>
          <button type="button" onClick={() => window.location.reload()}>Tải lại đơn thanh toán</button>
        </>}
      </section></main>
    </div>;
  }

  if (!plan) {
    return <div className="user-shell checkout-shell">
      <UserHeader />
      <main className="checkout-page user-content">
        <section className="checkout-empty">
          <Landmark size={36} aria-hidden="true" />
          <h1>Không tìm thấy gói thanh toán</h1>
          <p>Gói bạn chọn không còn trong bảng giá hiện tại. Hãy quay lại bảng giá để chọn lại.</p>
          <Link to="/#pricing"><ArrowLeft size={18} aria-hidden="true" /> Về bảng giá</Link>
        </section>
      </main>
    </div>;
  }

  const isFree = plan.amount === 0;
  const payPerUse = plan.id === 'pay-per-use';
  const caseQuantity = plan.entitlement?.type === 'case_credit' ? plan.entitlement.quantity : 1;
  const gateway = order?.provider === 'sepay_gateway';

  return <div className="user-shell checkout-shell">
    <UserHeader />
    <main className="checkout-page user-content">
      <Link className="checkout-back" to="/#pricing"><ArrowLeft size={17} aria-hidden="true" /> Quay lại bảng giá</Link>
      <section className="checkout-hero" aria-labelledby="checkout-heading">
        <div>
          <p className="checkout-eyebrow"><Sparkles size={16} aria-hidden="true" /> Thanh toán CourtSim</p>
          <h1 id="checkout-heading">{isFree ? 'Kích hoạt trải nghiệm miễn phí' : `Thanh toán gói ${plan.name}`}</h1>
          <p>{isFree ? 'Freemium có 2 lượt mô phỏng và kết quả tổng quan. Mỗi tài khoản được dùng thử một lần.' : payPerUse ? `${plan.name} cộng ${caseQuantity} lượt mô phỏng, mở trợ lý luật và chấm điểm chi tiết sau khi thanh toán được xác nhận.` : 'Kiểm tra gói đã chọn trước khi tạo yêu cầu thanh toán chính thức của CourtSim.'}</p>
        </div>
        <aside aria-label="Gói đã chọn">
          <span>{plan.cadence}</span>
          <strong>{plan.price}</strong>
          <p>{plan.name}</p>
        </aside>
      </section>

      <div className="checkout-grid">
        <section className="checkout-card checkout-summary" aria-labelledby="summary-heading">
          <div className="checkout-card-heading">
            <CreditCard size={22} aria-hidden="true" />
            <div>
              <h2 id="summary-heading">Tóm tắt đơn hàng</h2>
              <p>{payPerUse ? `Bạn đang mua trước ${caseQuantity} lượt mô phỏng để mở ${caseQuantity} case.` : 'Gói luyện tập bạn đang chuẩn bị kích hoạt.'}</p>
            </div>
          </div>
          <dl className="checkout-facts">
            <div><dt>Gói</dt><dd>{plan.name}</dd></div>
            <div><dt>Loại</dt><dd>{plan.cadence}</dd></div>
            <div><dt>Tạm tính</dt><dd>{formatMoney(plan.amount)}</dd></div>
            <div><dt>Trạng thái</dt><dd>{order ? statusText[order.status] ?? order.status : isFree ? 'Không cần thanh toán' : 'Chờ tạo thanh toán'}</dd></div>
          </dl>
          <div className="checkout-total">
            <span>Tổng thanh toán</span>
            <strong>{formatMoney(plan.amount)}</strong>
          </div>
        </section>

        <section className="checkout-card checkout-method" aria-labelledby="method-heading">
          <div className="checkout-card-heading">
            <ShieldCheck size={22} aria-hidden="true" />
            <div>
              <h2 id="method-heading">Phương thức thanh toán</h2>
              <p>{isFree ? 'Bạn có thể bắt đầu luyện tập ngay.' : 'Thanh toán qua cổng SePay, quyền lợi tự cập nhật sau khi được xác nhận.'}</p>
            </div>
          </div>
          <div className="checkout-method-box">
            <CheckCircle2 size={21} aria-hidden="true" />
            <div>
              <strong>{isFree ? 'Kích hoạt Freemium' : 'Thanh toán ngân hàng qua SePay'}</strong>
              <p>{isFree ? 'Không phát sinh chi phí cho 2 case đầu tiên.' : 'Quét mã QR và làm theo hướng dẫn trên trang thanh toán. Sau đó quay về CourtSim để xem kết quả.'}</p>
            </div>
          </div>
          {isFree ? <Link className="checkout-primary" to="/dashboard/setup">Bắt đầu luyện tập <ArrowRight size={18} aria-hidden="true" /></Link> : <button className="checkout-primary" type="button" disabled={busy || loadingOrder || Boolean(order) || Boolean(orderCode)} onClick={createOrder}>{loadingOrder ? 'Đang tải đơn thanh toán...' : busy ? 'Đang mở thanh toán...' : order ? 'Đã tạo yêu cầu thanh toán' : 'Thanh toán qua SePay'}<ArrowRight size={18} aria-hidden="true" /></button>}
          {error && <p className="checkout-note checkout-error" role="alert">{error}</p>}
          {!isFree && !order && <p className="checkout-note">Kiểm tra gói và số tiền trước khi tiếp tục thanh toán.</p>}
          {order && <div className="checkout-order" role="status">
            <span>{gateway ? 'Mã đơn thanh toán' : 'Nội dung chuyển khoản'}</span>
            <strong>{order.orderCode ?? order.order_code}</strong>
            {gateway ? <div className="checkout-gateway-result">
              <h3>{order.status === 'paid' ? 'Thanh toán thành công' : order.status === 'processing' ? 'Đang cập nhật quyền lợi' : returnResult === 'cancel' ? 'Bạn đã hủy thao tác thanh toán' : returnResult === 'error' ? 'Thanh toán chưa hoàn tất' : 'Đang chờ xác nhận thanh toán'}</h3>
              <p>{order.status === 'paid' ? 'CourtSim đã xác nhận giao dịch và cấp quyền lợi cho tài khoản của bạn.' : 'CourtSim đang kiểm tra giao dịch với SePay. Nếu đã chuyển tiền, hãy chờ và kiểm tra trạng thái trước khi thanh toán tiếp.'}</p>
              {order.status !== 'paid' && order.verification?.available === false && <p className="checkout-note checkout-error">Chưa thể kiểm tra giao dịch với SePay. Hệ thống sẽ tự thử lại; bạn chưa cần thanh toán thêm.</p>}
              <dl className="checkout-facts">
                <div><dt>Số tiền</dt><dd>{formatMoney(order.amount)}</dd></div>
                <div><dt>Trạng thái</dt><dd>{statusText[order.status] ?? order.status}</dd></div>
                {order.status === 'pending' && <div><dt>Thời gian tiếp tục đơn</dt><dd>{countdown}</dd></div>}
              </dl>
            </div> : <><div className="checkout-qr-wrap">
              {!qrMissing ? <img src={order.payment.qr_image_url} alt={`QR chuyển khoản tới ${order.payment.account_name}`} onError={() => setQrMissing(true)} /> : <div className="checkout-qr-missing">Chưa có ảnh QR trong hệ thống</div>}
              <dl>
                <div><dt>Ngân hàng</dt><dd>{order.payment.bank_code || 'Theo QR'}</dd></div>
                <div><dt>Chủ tài khoản</dt><dd>{order.payment.account_name}</dd></div>
                <div><dt>Số tài khoản</dt><dd>{order.payment.account_number || order.payment.account_mask}</dd></div>
                <div><dt>Số tiền</dt><dd>{formatMoney(order.amount)}</dd></div>
                <div><dt>Nội dung</dt><dd>{order.payment.transfer_content}</dd></div>
                <div><dt>Hết hạn sau</dt><dd>{order.status === 'pending' ? countdown : statusText[order.status] ?? order.status}</dd></div>
              </dl>
            </div>
            <p>Vui lòng chuyển khoản đúng số tiền và đúng nội dung. CourtSim tự xác minh khi nhận xác nhận từ SePay. Trạng thái hiện tại: <b>{statusText[order.status] ?? order.status}</b>.</p></>}
            <div className="checkout-order-actions">
              {gateway && order.status === 'pending' && <button type="button" onClick={continuePayment} disabled={busy}>{busy ? 'Đang mở SePay...' : 'Tiếp tục thanh toán trên SePay'}</button>}
              {order.status !== 'paid' && <button type="button" onClick={() => refreshOrder()} disabled={checking}>{checking ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái'}</button>}
              {['expired', 'cancelled'].includes(order.status) && <button type="button" onClick={() => { setOrder(null); setError(''); setQrMissing(false); setSearchParams({}, { replace: true }); }}>Tạo đơn mới</button>}
              {order.status === 'paid' && <Link to="/dashboard/setup">Tiếp tục luyện tập <ArrowRight size={16} aria-hidden="true" /></Link>}
            </div>
            {accessSynced && <p>Quyền lợi thành viên đã được cập nhật.</p>}
          </div>}
        </section>
      </div>

      <section className="checkout-card checkout-includes" aria-labelledby="includes-heading">
        <h2 id="includes-heading">Quyền lợi trong gói {plan.name}</h2>
        <div>
          {plan.bullets.map((item) => <span key={item}><CheckCircle2 size={17} aria-hidden="true" />{item}</span>)}
        </div>
      </section>
    </main>
  </div>;
}
