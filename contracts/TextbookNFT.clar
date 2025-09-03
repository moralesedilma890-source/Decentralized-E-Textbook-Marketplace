;; TextbookNFT.clar
;; Core smart contract for minting and managing e-textbook NFTs on Stacks blockchain.
;; This contract implements a robust NFT system compliant with SIP-009 traits, 
;; focusing on authenticity verification via content hashes to combat piracy.
;; Features include minting, transferring, burning, metadata management, 
;; royalty settings, pausing, and admin controls.

;; Traits
(define-trait nft-trait
    (
        (get-owner (uint) (response (optional principal) uint))
        (transfer (uint principal principal) (response bool uint))
    )
)

;; Constants
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-PAUSED u101)
(define-constant ERR-INVALID-TOKEN-ID u102)
(define-constant ERR-INVALID-AMOUNT u103)
(define-constant ERR-INVALID-RECIPIENT u104)
(define-constant ERR-ALREADY-REGISTERED u105)
(define-constant ERR-METADATA-TOO-LONG u106)
(define-constant ERR-ROYALTY-TOO-HIGH u107)
(define-constant ERR-NOT-OWNER u108)
(define-constant ERR-TOKEN-NOT-EXISTS u109)
(define-constant ERR-INVALID-HASH u110)
(define-constant ERR-VERSION-ALREADY-EXISTS u111)
(define-constant ERR-LICENSE-EXPIRED u112)
(define-constant ERR-INVALID-CATEGORY u113)
(define-constant ERR-TOO-MANY-TAGS u114)
(define-constant ERR-INVALID-PERMISSION u115)
(define-constant ERR-INVALID-STATUS u116)
(define-constant ERR-SHARE-EXCEEDS-100 u117)
(define-constant MAX-METADATA-LEN u500)
(define-constant MAX-TAGS u10)
(define-constant MAX-PERMISSIONS u5)
(define-constant MAX-ROYALTY-PERCENT u1000) ;; 10% max, in basis points

;; Data Variables
(define-data-var contract-admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var token-counter uint u0)
(define-data-var total-royalties-collected uint u0)

;; Data Maps
(define-map token-owners uint principal)
(define-map token-metadata 
  uint 
  {
    content-hash: (buff 32), ;; SHA-256 hash for authenticity
    title: (string-utf8 100),
    description: (string-utf8 500),
    initial-price: uint,
    uri: (optional (string-ascii 256)), ;; Optional off-chain metadata URI
    mint-timestamp: uint
  }
)

(define-map token-royalties
  uint
  {
    recipient: principal,
    percentage: uint ;; in basis points (1/10000)
  }
)

(define-map token-versions
  { token-id: uint, version: uint }
  {
    updated-hash: (buff 32),
    update-notes: (string-utf8 200),
    timestamp: uint
  }
)

(define-map token-licenses
  { token-id: uint, licensee: principal }
  {
    expiry: uint,
    terms: (string-utf8 200),
    active: bool
  }
)

(define-map token-categories
  uint
  {
    category: (string-utf8 50),
    tags: (list 10 (string-utf8 20))
  }
)

(define-map token-collaborators
  { token-id: uint, collaborator: principal }
  {
    role: (string-utf8 50),
    permissions: (list 5 (string-utf8 20)),
    added-at: uint
  }
)

(define-map token-status
  uint
  {
    status: (string-utf8 20), ;; e.g., "active", "archived"
    visibility: bool,
    last-updated: uint
  }
)

(define-map revenue-shares
  { token-id: uint, participant: principal }
  {
    percentage: uint, ;; in percent
    total-received: uint
  }
)

;; Private Functions
(define-private (is-admin (caller principal))
  (is-eq caller (var-get contract-admin))
)

(define-private (increment-token-counter)
  (let ((current (var-get token-counter)))
    (var-set token-counter (+ current u1))
    (+ current u1)
  )
)

(define-private (validate-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
    true
    false
  )
)

(define-private (validate-metadata (description (string-utf8 500)))
  (if (> (len description) MAX-METADATA-LEN)
    false
    true
  )
)

(define-private (validate-title (title (string-utf8 100)))
    (and 
        (>= (len title) u1)
        (<= (len title) u100)
    )
)

(define-private (validate-price (price uint))
    (> price u0)
)

(define-private (validate-uri (uri (optional (string-ascii 256))))
    (match uri
        uri-string (<= (len uri-string) u256)
        true
    )
)

;; Public Functions

;; Mint a new textbook NFT
(define-public (mint-textbook 
    (content-hash (buff 32)) 
    (title (string-utf8 100)) 
    (description (string-utf8 500))
    (initial-price uint)
    (uri (optional (string-ascii 256))))
    (let 
        (
            (token-id (increment-token-counter))
            (sender tx-sender)
        )
        (if (var-get paused)
            (err ERR-PAUSED)
            (if (and 
                    (validate-hash content-hash)
                    (validate-metadata description)
                    (validate-title title)
                    (validate-price initial-price)
                    (validate-uri uri))
                (begin
                    (map-set token-owners token-id sender)
                    (map-set token-metadata token-id 
                        {
                            content-hash: content-hash,
                            title: title,
                            description: description,
                            initial-price: initial-price,
                            uri: uri,
                            mint-timestamp: block-height
                        }
                    )
                    (map-set token-status token-id
                        {
                            status: "active",
                            visibility: true,
                            last-updated: block-height
                        }
                    )
                    (print { event: "mint", token-id: token-id, owner: sender })
                    (ok token-id)
                )
                (err ERR-INVALID-HASH)
            )
        )
    )
)

;; Transfer NFT ownership
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (let ((owner (map-get? token-owners token-id)))
    (if (var-get paused)
      (err ERR-PAUSED)
      (if (and (is-some owner) (is-eq (unwrap-panic owner) tx-sender) (is-eq sender tx-sender))
        (begin
          (map-set token-owners token-id recipient)
          (print { event: "transfer", token-id: token-id, from: sender, to: recipient })
          (ok true)
        )
        (err ERR-NOT-OWNER)
      )
    )
  )
)

;; Burn NFT
(define-public (burn (token-id uint))
  (let ((owner (map-get? token-owners token-id)))
    (if (var-get paused)
      (err ERR-PAUSED)
      (if (and (is-some owner) (is-eq (unwrap-panic owner) tx-sender))
        (begin
          (map-delete token-owners token-id)
          (map-delete token-metadata token-id)
          (map-delete token-royalties token-id)
          (map-delete token-categories token-id)
          (map-delete token-status token-id)
          ;; Note: Other maps like versions, licenses, etc., should be cleaned in production
          (print { event: "burn", token-id: token-id })
          (ok true)
        )
        (err ERR-NOT-OWNER)
      )
    )
  )
)

;; Set royalty for token
(define-public (set-royalty (token-id uint) (recipient principal) (percentage uint))
  (let ((owner (map-get? token-owners token-id)))
    (if (and (is-some owner) (is-eq (unwrap-panic owner) tx-sender))
      (if (> percentage MAX-ROYALTY-PERCENT)
        (err ERR-ROYALTY-TOO-HIGH)
        (begin
          (map-set token-royalties token-id { recipient: recipient, percentage: percentage })
          (ok true)
        )
      )
      (err ERR-NOT-OWNER)
    )
  )
)

;; Register new version
(define-public (register-new-version 
  (token-id uint) 
  (version uint)
  (updated-hash (buff 32)) 
  (notes (string-utf8 200)))
  (let ((owner (map-get? token-owners token-id)))
    (if (and (is-some owner) (is-eq (unwrap-panic owner) tx-sender))
      (if (is-some (map-get? token-versions { token-id: token-id, version: version }))
        (err ERR-VERSION-ALREADY-EXISTS)
        (if (not (validate-hash updated-hash))
          (err ERR-INVALID-HASH)
          (begin
            (map-set token-versions { token-id: token-id, version: version }
              {
                updated-hash: updated-hash,
                update-notes: notes,
                timestamp: block-height
              }
            )
            (print { event: "new-version", token-id: token-id, version: version })
            (ok true)
          )
        )
      )
      (err ERR-NOT-OWNER)
    )
  )
)

;; Grant license
(define-public (grant-license 
  (token-id uint) 
  (licensee principal)
  (duration uint)
  (terms (string-utf8 200)))
  (let ((owner (map-get? token-owners token-id)))
    (if (and (is-some owner) (is-eq (unwrap-panic owner) tx-sender))
      (begin
        (map-set token-licenses { token-id: token-id, licensee: licensee }
          {
            expiry: (+ block-height duration),
            terms: terms,
            active: true
          }
        )
        (print { event: "license-granted", token-id: token-id, licensee: licensee })
        (ok true)
      )
      (err ERR-NOT-OWNER)
    )
  )
)

;; Revoke license
(define-public (revoke-license (token-id uint) (licensee principal))
  (let ((owner (map-get? token-owners token-id)))
    (if (and (is-some owner) (is-eq (unwrap-panic owner) tx-sender))
      (match (map-get? token-licenses { token-id: token-id, licensee: licensee })
        license
        (begin
          (map-set token-licenses { token-id: token-id, licensee: licensee }
            (merge license { active: false })
          )
          (print { event: "license-revoked", token-id: token-id, licensee: licensee })
          (ok true)
        )
        (err ERR-NOT-AUTHORIZED)
      )
      (err ERR-NOT-OWNER)
    )
  )
)

;; Add category and tags
(define-public (add-category
  (token-id uint)
  (category (string-utf8 50))
  (tags (list 10 (string-utf8 20))))
  (let ((owner (map-get? token-owners token-id)))
    (if (and (is-some owner) (is-eq (unwrap-panic owner) tx-sender))
      (if (> (len tags) MAX-TAGS)
        (err ERR-TOO-MANY-TAGS)
        (begin
          (map-set token-categories token-id { category: category, tags: tags })
          (ok true)
        )
      )
      (err ERR-NOT-OWNER)
    )
  )
)

;; Add collaborator
(define-public (add-collaborator
  (token-id uint)
  (collaborator principal)
  (role (string-utf8 50))
  (permissions (list 5 (string-utf8 20))))
  (let ((owner (map-get? token-owners token-id)))
    (if (and (is-some owner) (is-eq (unwrap-panic owner) tx-sender))
      (if (> (len permissions) MAX-PERMISSIONS)
        (err ERR-INVALID-PERMISSION)
        (begin
          (map-set token-collaborators { token-id: token-id, collaborator: collaborator }
            {
              role: role,
              permissions: permissions,
              added-at: block-height
            }
          )
          (ok true)
        )
      )
      (err ERR-NOT-OWNER)
    )
  )
)

;; Update status
(define-public (update-status
  (token-id uint)
  (status (string-utf8 20))
  (visibility bool))
  (let ((owner (map-get? token-owners token-id)))
    (if (and (is-some owner) (is-eq (unwrap-panic owner) tx-sender))
      (begin
        (map-set token-status token-id
          {
            status: status,
            visibility: visibility,
            last-updated: block-height
          }
        )
        (ok true)
      )
      (err ERR-NOT-OWNER)
    )
  )
)

;; Set revenue share
(define-public (set-revenue-share
  (token-id uint)
  (participant principal)
  (percentage uint))
  (let ((owner (map-get? token-owners token-id)))
    (if (and (is-some owner) (is-eq (unwrap-panic owner) tx-sender))
      (if (> percentage u100)
        (err ERR-SHARE-EXCEEDS-100)
        (begin
          (map-set revenue-shares { token-id: token-id, participant: participant }
            {
              percentage: percentage,
              total-received: u0
            }
          )
          (ok true)
        )
      )
      (err ERR-NOT-OWNER)
    )
  )
)

;; Admin functions
(define-public (set-admin (new-admin principal))
  (if (is-admin tx-sender)
    (begin
      (var-set contract-admin new-admin)
      (ok true)
    )
    (err ERR-NOT-AUTHORIZED)
  )
)

(define-public (pause)
  (if (is-admin tx-sender)
    (begin
      (var-set paused true)
      (ok true)
    )
    (err ERR-NOT-AUTHORIZED)
  )
)

(define-public (unpause)
  (if (is-admin tx-sender)
    (begin
      (var-set paused false)
      (ok true)
    )
    (err ERR-NOT-AUTHORIZED)
  )
)

;; Read-only Functions

(define-read-only (get-owner (token-id uint))
  (ok (map-get? token-owners token-id))
)

(define-read-only (get-metadata (token-id uint))
  (map-get? token-metadata token-id)
)

(define-read-only (get-royalty (token-id uint))
  (map-get? token-royalties token-id)
)

(define-read-only (get-version (token-id uint) (version uint))
  (map-get? token-versions { token-id: token-id, version: version })
)

(define-read-only (get-license (token-id uint) (licensee principal))
  (map-get? token-licenses { token-id: token-id, licensee: licensee })
)

(define-read-only (get-category (token-id uint))
  (map-get? token-categories token-id)
)

(define-read-only (get-collaborator (token-id uint) (collaborator principal))
  (map-get? token-collaborators { token-id: token-id, collaborator: collaborator })
)

(define-read-only (get-status (token-id uint))
  (map-get? token-status token-id)
)

(define-read-only (get-revenue-share (token-id uint) (participant principal))
  (map-get? revenue-shares { token-id: token-id, participant: participant })
)

(define-read-only (is-paused)
  (var-get paused)
)

(define-read-only (get-admin)
  (var-get contract-admin)
)

(define-read-only (get-token-count)
  (var-get token-counter)
)

(define-read-only (verify-authenticity (token-id uint) (provided-hash (buff 32)))
  (match (map-get? token-metadata token-id)
    metadata
    (is-eq (get content-hash metadata) provided-hash)
    false
  )
)