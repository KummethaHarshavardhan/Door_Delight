import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, Smartphone } from 'lucide-react';
import { orderAPI, paymentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/formatters';

const UPI_APPS = ['Google Pay', 'PhonePe', 'Paytm', 'Other UPI Apps'];

export default function CheckoutPaymentPage() {
  const { state } = useLocation();
  const { user } = useAuth();
  const { cart, fetchCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [address, setAddress] = useState(() => {
    if (state?.address) return state.address;
    try {
      const saved = sessionStorage.getItem('dd_checkout_address');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [upiApp, setUpiApp] = useState('Google Pay');
  const [instructions, setInstructions] = useState('');
  const [processing, setProcessing] = useState(false);
  const [failedOrder, setFailedOrder] = useState(null);

  useEffect(() => {
    if (!address) {
      navigate('/customer/checkout/location', { replace: true });
    }
  }, [address, navigate]);

  const initiateRazorpayPayment = async (order) => {
    const rzpRes = await paymentAPI.createRazorpayOrder({
      order_id: order.id,
      idempotency_key: `rzp_${order.id}`,
    });
    const rzpData = rzpRes.data;

    if (!window.Razorpay) {
      showToast('Razorpay SDK not loaded. Check your internet connection.', 'error');
      setFailedOrder(order);
      return;
    }

    const options = {
      key: rzpData.key_id,
      amount: rzpData.amount,
      currency: rzpData.currency,
      name: 'DoorDelight',
      description: `Order ${rzpData.order_number} (${upiApp})`,
      order_id: rzpData.razorpay_order_id,
      prefill: {
        name: user?.name || '',
        email: user?.email || '',
        contact: address?.phone || user?.phone || '',
      },
      handler: async (response) => {
        try {
          await paymentAPI.verifyRazorpay({
            order_id: order.id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          await fetchCart();
          sessionStorage.removeItem('dd_checkout_address');
          showToast('Payment verified! Finding your delivery partner...', 'success');
          navigate(`/customer/orders/${order.id}/finding`, { replace: true });
        } catch (err) {
          setFailedOrder(order);
          showToast(err.response?.data?.detail || 'Payment verification failed', 'error');
        }
      },
      modal: {
        ondismiss: async () => {
          await paymentAPI.failRazorpay({
            order_id: order.id,
            razorpay_order_id: rzpData.razorpay_order_id,
            reason: 'UPI payment cancelled before completion',
          });
          await fetchCart();
          setFailedOrder(order);
          showToast('UPI payment was cancelled. You can retry below.', 'error');
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', async () => {
      await paymentAPI.failRazorpay({
        order_id: order.id,
        razorpay_order_id: rzpData.razorpay_order_id,
        reason: 'UPI payment failed at gateway',
      });
      setFailedOrder(order);
      showToast('Payment failed. Please retry.', 'error');
    });
    rzp.open();
  };

  const handleConfirmPayment = async () => {
    if (!address) return;
    setProcessing(true);
    try {
      if (failedOrder && paymentMethod === 'RAZORPAY') {
        await initiateRazorpayPayment(failedOrder);
        return;
      }

      const idempotencyKey = `dd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const orderRes = await orderAPI.place({
        address_id: address.id,
        payment_method: paymentMethod,
        special_instructions: instructions,
        idempotency_key: idempotencyKey,
      });
      const createdOrder = orderRes.data.order;

      if (paymentMethod === 'COD') {
        await fetchCart();
        sessionStorage.removeItem('dd_checkout_address');
        showToast('COD Order placed! Finding your delivery partner...', 'success');
        navigate(`/customer/orders/${createdOrder.id}/finding`, { replace: true });
        return;
      }

      await initiateRazorpayPayment(createdOrder);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not process order', 'error');
    } finally {
      setProcessing(false);
    }
  };

  if (!address) return null;

  return (
    <div className="page-enter" style={{ maxWidth: 680, margin: '0 auto' }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: 14 }}
        onClick={() => navigate('/customer/checkout/location')}
      >
        <ArrowLeft size={15} /> Change Delivery Location
      </button>

      <div className="card card-glass">
        <div className="card-body" style={{ padding: 26 }}>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: 6 }}>Select Payment Method</h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 18 }}>
            Delivering to: <strong>{address.label}</strong> — {address.street}, {address.city} ({address.pincode})
          </p>

          <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
            <label
              className="card"
              style={{
                padding: 16,
                cursor: 'pointer',
                borderColor: paymentMethod === 'COD' ? 'var(--primary)' : 'var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <input
                type="radio"
                name="payMethod"
                checked={paymentMethod === 'COD'}
                onChange={() => setPaymentMethod('COD')}
              />
              <Banknote size={22} color="var(--primary)" />
              <div>
                <div style={{ fontWeight: 800 }}>Cash on Delivery (COD)</div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  Pay {formatCurrency(cart.total_amount)} in cash when your order arrives
                </div>
              </div>
            </label>

            <label
              className="card"
              style={{
                padding: 16,
                cursor: 'pointer',
                borderColor: paymentMethod === 'RAZORPAY' ? 'var(--primary)' : 'var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="radio"
                  name="payMethod"
                  checked={paymentMethod === 'RAZORPAY'}
                  onChange={() => setPaymentMethod('RAZORPAY')}
                />
                <Smartphone size={22} color="var(--secondary)" />
                <div>
                  <div style={{ fontWeight: 800 }}>UPI Payment (Razorpay Test Mode)</div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    Pay securely via Google Pay, PhonePe, Paytm, or other UPI apps
                  </div>
                </div>
              </div>

              {paymentMethod === 'RAZORPAY' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingLeft: 26 }}>
                  {UPI_APPS.map((app) => (
                    <button
                      key={app}
                      type="button"
                      className={`btn btn-sm ${upiApp === app ? 'btn-violet' : 'btn-secondary'}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setUpiApp(app);
                      }}
                    >
                      {app}
                    </button>
                  ))}
                </div>
              )}
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Delivery Instructions (Optional)</label>
            <textarea
              className="textarea"
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ring doorbell, leave at gate, etc."
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 800,
              fontSize: '1.15rem',
              padding: '12px 0',
              borderTop: '1px solid var(--border)',
              marginBottom: 14,
            }}
          >
            <span>Final Payable Amount</span>
            <span>{formatCurrency(failedOrder ? failedOrder.total_amount : cart.total_amount)}</span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={processing}
            onClick={handleConfirmPayment}
          >
            {processing
              ? 'Processing...'
              : failedOrder && paymentMethod === 'RAZORPAY'
                ? `Retry ${upiApp} Payment`
                : paymentMethod === 'COD'
                  ? `Place COD Order (${formatCurrency(cart.total_amount)})`
                  : `Pay via ${upiApp} (${formatCurrency(cart.total_amount)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
