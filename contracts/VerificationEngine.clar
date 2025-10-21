(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-DOCTOR-NOT-FOUND u101)
(define-constant ERR-CREDENTIAL-NOT-FOUND u102)
(define-constant ERR-CREDENTIAL-EXPIRED u103)
(define-constant ERR-CREDENTIAL-REVOKED u104)
(define-constant ERR-INVALID-ISSUER u105)
(define-constant ERR-INVALID-HASH u106)
(define-constant ERR-INVALID-EXPIRATION u107)
(define-constant ERR-INVALID-SPECIALTY u108)
(define-constant ERR-INVALID-REGION u109)
(define-constant ERR-VERIFICATION-FAILED u110)
(define-constant ERR-INVALID-TIMESTAMP u111)
(define-constant ERR-INVALID-STATUS u112)
(define-constant ERR-MAX-VERIFICATIONS-EXCEEDED u113)
(define-constant ERR-INVALID-PATIENT u114)
(define-constant ERR-INVALID-SESSION-ID u115)
(define-constant ERR-SESSION-ALREADY-VERIFIED u116)
(define-constant ERR-INVALID-VERIFICATION-FEE u117)
(define-constant ERR-TRANSFER-FAILED u118)
(define-constant ERR-INVALID-AUDIT-LOG u119)
(define-constant ERR-INVALID-QUERY-PARAM u120)

(define-data-var next-verification-id uint u0)
(define-data-var max-verifications uint u100000)
(define-data-var verification-fee uint u500)
(define-data-var admin-principal principal tx-sender)
(define-data-var credential-issuer-contract (optional principal) none)
(define-data-var doctor-registry-contract (optional principal) none)
(define-data-var credential-storage-contract (optional principal) none)

(define-map verifications
  uint
  {
    doctor: principal,
    patient: (optional principal),
    session-id: (optional uint),
    credential-hash: (buff 32),
    expiration: uint,
    issuer: principal,
    specialty: (string-utf8 50),
    region: (string-utf8 100),
    timestamp: uint,
    status: bool,
    revoked: bool
  }
)

(define-map verification-logs
  uint
  {
    verification-id: uint,
    verifier: principal,
    timestamp: uint,
    result: bool
  }
)

(define-map doctor-verification-count
  principal
  uint
)

(define-read-only (get-verification (id uint))
  (map-get? verifications id)
)

(define-read-only (get-verification-log (id uint))
  (map-get? verification-logs id)
)

(define-read-only (get-doctor-verification-count (doctor principal))
  (default-to u0 (map-get? doctor-verification-count doctor))
)

(define-read-only (is-doctor-registered (doctor principal))
  (is-some (contract-call? (unwrap-panic (var-get doctor-registry-contract)) get-doctor doctor))
)

(define-private (validate-doctor (doctor principal))
  (if (is-doctor-registered doctor)
    (ok true)
    (err ERR-DOCTOR-NOT-FOUND)
  )
)

(define-private (validate-credential-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
    (ok true)
    (err ERR-INVALID-HASH)
  )
)

(define-private (validate-expiration (exp uint))
  (if (> exp block-height)
    (ok true)
    (err ERR-INVALID-EXPIRATION)
  )
)

(define-private (validate-issuer (issuer principal))
  (if (is-eq issuer (unwrap-panic (var-get credential-issuer-contract)))
    (ok true)
    (err ERR-INVALID-ISSUER)
  )
)

(define-private (validate-specialty (spec (string-utf8 50)))
  (if (and (> (len spec) u0) (<= (len spec) u50))
    (ok true)
    (err ERR-INVALID-SPECIALTY)
  )
)

(define-private (validate-region (reg (string-utf8 100)))
  (if (and (> (len reg) u0) (<= (len reg) u100))
    (ok true)
    (err ERR-INVALID-REGION)
  )
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR-INVALID-TIMESTAMP)
  )
)

(define-private (validate-status (status bool))
  (if status
    (ok true)
    (err ERR-INVALID-STATUS)
  )
)

(define-private (validate-session-id (sid uint))
  (if (> sid u0)
    (ok true)
    (err ERR-INVALID-SESSION-ID)
  )
)

(define-public (set-credential-issuer-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (var-set credential-issuer-contract (some contract))
    (ok true)
  )
)

(define-public (set-doctor-registry-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (var-set doctor-registry-contract (some contract))
    (ok true)
  )
)

(define-public (set-credential-storage-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (var-set credential-storage-contract (some contract))
    (ok true)
  )
)

(define-public (set-verification-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender (var-get admin-principal)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> new-fee u0) (err ERR-INVALID-VERIFICATION-FEE))
    (var-set verification-fee new-fee)
    (ok true)
  )
)

(define-public (verify-credential
  (doctor principal)
  (credential-hash (buff 32))
  (patient (optional principal))
  (session-id (optional uint))
)
  (let
    (
      (next-id (var-get next-verification-id))
      (cred (unwrap! (contract-call? (unwrap-panic (var-get credential-storage-contract)) get-credential credential-hash) (err ERR-CREDENTIAL-NOT-FOUND)))
      (exp (get expiration cred))
      (issuer (get issuer cred))
      (spec (get specialty cred))
      (reg (get region cred))
      (revoked (get revoked cred))
      (count (get-doctor-verification-count doctor))
    )
    (asserts! (< next-id (var-get max-verifications)) (err ERR-MAX-VERIFICATIONS-EXCEEDED))
    (try! (validate-doctor doctor))
    (try! (validate-credential-hash credential-hash))
    (try! (validate-expiration exp))
    (try! (validate-issuer issuer))
    (try! (validate-specialty spec))
    (try! (validate-region reg))
    (asserts! (not revoked) (err ERR-CREDENTIAL-REVOKED))
    (match session-id sid (try! (validate-session-id sid)) true)
    (try! (stx-transfer? (var-get verification-fee) tx-sender (var-get admin-principal)))
    (map-set verifications next-id
      {
        doctor: doctor,
        patient: patient,
        session-id: session-id,
        credential-hash: credential-hash,
        expiration: exp,
        issuer: issuer,
        specialty: spec,
        region: reg,
        timestamp: block-height,
        status: true,
        revoked: false
      }
    )
    (map-set verification-logs next-id
      {
        verification-id: next-id,
        verifier: tx-sender,
        timestamp: block-height,
        result: true
      }
    )
    (map-set doctor-verification-count doctor (+ count u1))
    (var-set next-verification-id (+ next-id u1))
    (print { event: "credential-verified", id: next-id, doctor: doctor })
    (ok next-id)
  )
)

(define-public (revoke-verification (id uint))
  (let ((verif (map-get? verifications id)))
    (match verif v
      (begin
        (asserts! (is-eq tx-sender (get issuer v)) (err ERR-NOT-AUTHORIZED))
        (map-set verifications id (merge v { revoked: true, status: false }))
        (print { event: "verification-revoked", id: id })
        (ok true)
      )
      (err ERR-CREDENTIAL-NOT-FOUND)
    )
  )
)

(define-public (get-verification-count)
  (ok (var-get next-verification-id))
)

(define-public (check-verification-status (id uint))
  (let ((verif (map-get? verifications id)))
    (match verif v
      (ok (get status v))
      (err ERR-CREDENTIAL-NOT-FOUND)
    )
  )
)