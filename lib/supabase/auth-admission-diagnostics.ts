import 'server-only'

/** Finite server-only outcomes. Never attach an error, request, identifier,
 * timing, header, credential, SQL text or derived principal to these messages. */
const messages = {
  limited: 'picshaw_auth_admission:limited',
  configuration_unavailable: 'picshaw_auth_admission:configuration_unavailable',
  runtime_unavailable: 'picshaw_auth_admission:runtime_unavailable',
  action_rejected: 'picshaw_auth_admission:action_rejected',
  ingress_origin_rejected: 'picshaw_auth_admission:ingress_origin_rejected',
  ingress_principal_unavailable: 'picshaw_auth_admission:ingress_principal_unavailable',
  ingress_identity_mismatch: 'picshaw_auth_admission:ingress_identity_mismatch',
  backend_deadline: 'picshaw_auth_admission:backend_deadline',
  backend_tls_rejected: 'picshaw_auth_admission:backend_tls_rejected',
  backend_login_rejected: 'picshaw_auth_admission:backend_login_rejected',
  backend_access_denied: 'picshaw_auth_admission:backend_access_denied',
  backend_dns_unavailable: 'picshaw_auth_admission:backend_dns_unavailable',
  backend_connection_unavailable: 'picshaw_auth_admission:backend_connection_unavailable',
  backend_contract_unavailable: 'picshaw_auth_admission:backend_contract_unavailable',
  backend_result_invalid: 'picshaw_auth_admission:backend_result_invalid',
  backend_unavailable: 'picshaw_auth_admission:backend_unavailable',
} as const
export type AdmissionDiagnostic = keyof typeof messages

/** Logging is deliberately best-effort and cannot permit or block admission. */
export function reportAdmissionDiagnostic(code: AdmissionDiagnostic) {
  try {
    if (typeof code === 'string' && Object.hasOwn(messages, code)) console.warn(messages[code])
  } catch { /* A logging outage must never change the decision. */ }
}

export class AdmissionIngressError extends Error {
  constructor(readonly outcome: 'ingress_origin_rejected' | 'ingress_principal_unavailable' | 'ingress_identity_mismatch') {
    super('Admission ingress rejected.')
  }
}
export class AdmissionDeadlineError extends Error {}

const errors: Readonly<Record<string, AdmissionDiagnostic>> = {
  CONNECT_TIMEOUT: 'backend_deadline', QUERY_TIMEOUT: 'backend_deadline', QUEUE_TIMEOUT: 'backend_deadline',
  CERT_HAS_EXPIRED: 'backend_tls_rejected', CERT_NOT_YET_VALID: 'backend_tls_rejected',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'backend_tls_rejected', SELF_SIGNED_CERT_IN_CHAIN: 'backend_tls_rejected',
  UNABLE_TO_GET_ISSUER_CERT: 'backend_tls_rejected', UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'backend_tls_rejected',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'backend_tls_rejected', ERR_TLS_CERT_ALTNAME_INVALID: 'backend_tls_rejected',
  ERR_TLS_CERT_ALTNAME_FORMAT: 'backend_tls_rejected', TLS_HANDSHAKE_FAILED: 'backend_tls_rejected',
  '28P01': 'backend_login_rejected', '28000': 'backend_login_rejected',
  '42501': 'backend_access_denied',
  ENOTFOUND: 'backend_dns_unavailable', EAI_AGAIN: 'backend_dns_unavailable',
  ECONNREFUSED: 'backend_connection_unavailable', ECONNRESET: 'backend_connection_unavailable',
  ETIMEDOUT: 'backend_connection_unavailable', CONNECTION_CLOSED: 'backend_connection_unavailable',
  CONNECTION_ENDED: 'backend_connection_unavailable', CONNECTION_DESTROYED: 'backend_connection_unavailable',
  '53300': 'backend_connection_unavailable',
  '3D000': 'backend_contract_unavailable', '3F000': 'backend_contract_unavailable', '42883': 'backend_contract_unavailable',
}
export function admissionFailureDiagnostic(error: unknown): AdmissionDiagnostic {
  try {
    if (error instanceof AdmissionIngressError) return error.outcome
    if (error instanceof AdmissionDeadlineError) return 'backend_deadline'
    if (error && typeof error === 'object' && 'code' in error) {
      const code = error.code
      if (typeof code === 'string' && Object.hasOwn(errors, code)) return errors[code]
    }
  } catch { /* Untrusted error getters are never evaluated for logging again. */ }
  return 'backend_unavailable'
}
