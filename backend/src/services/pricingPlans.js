import { MEMBERSHIP_PLANS } from '../../../shared/membershipPolicy.mjs';

export const PAYMENT_PRODUCTS = Object.freeze({
  case: {
    type: 'case',
    id: 'pay-per-use',
    name: 'Pay-per-use',
    amount: 30000,
    caseCredits: 1,
    price: '30.000 VND/case',
    cadence: 'Mua tung case',
    paymentPurpose: 'Mua truoc 01 luot mo phong',
    entitlement: { type: 'case_credit', quantity: 1, unit: 'case', plan: 'pay-per-use' },
  },
  lite: {
    type: 'lite',
    id: 'lite',
    name: 'Lite',
    amount: 99000,
    caseCredits: 5,
    price: '99.000 VND',
    cadence: 'Bundle 5 case',
    paymentPurpose: 'Mua goi Lite 5 luot mo phong',
    entitlement: { type: 'case_credit', quantity: 5, unit: 'case', plan: 'lite' },
  },
  pro: {
    type: 'pro',
    id: 'pro',
    name: 'Pro',
    amount: 249000,
    price: '249.000 VND',
    cadence: 'Bundle nang cao',
    paymentPurpose: 'Mua goi Pro',
    entitlement: { type: 'pro_bundle', quantity: 1, unit: 'bundle' },
  },
});

export const checkoutPlans = Object.freeze({
  freemium: {
    id: 'freemium',
    type: 'freemium',
    name: 'Freemium',
    amount: 0,
    price: '2 case dau tien mien phi',
    cadence: 'Dung thu',
    paymentPurpose: 'Kich hoat trai nghiem mien phi',
    entitlement: { type: 'free_trial', quantity: 2, unit: 'case' },
  },
  'pay-per-use': PAYMENT_PRODUCTS.case,
  lite: PAYMENT_PRODUCTS.lite,
  pro: PAYMENT_PRODUCTS.pro,
});

export function normalizePaymentType(value) {
  if (value === 'pay-per-use') return 'case';
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function findPaymentProduct(type) {
  return PAYMENT_PRODUCTS[normalizePaymentType(type)] ?? null;
}

export function findCheckoutPlan(planId) {
  return checkoutPlans[planId] ?? null;
}

export function publicCheckoutPlan(plan) {
  return {
    id: plan.id,
    type: plan.type,
    name: plan.name,
    amount: plan.amount,
    price: plan.price,
    cadence: plan.cadence,
    paymentPurpose: plan.paymentPurpose,
    entitlement: plan.entitlement,
    features: MEMBERSHIP_PLANS[plan.id],
  };
}
