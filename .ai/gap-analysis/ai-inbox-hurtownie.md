---
project: ai-inbox-hurtownie
generated: 2026-09-30
sources:
  - AI Inbox dla hurtowni i składów budowlanych w Polsce_ rynek, proces i konkurencja (wrzesień 2026).pdf
phase: complete
total_epics: 9
total_stories: 52
coverage_categories:
  - negative-path
  - abuse-case
  - race-condition
  - tenant-isolation
  - data-privacy
  - audit-log
  - data-quality
---
<!-- data-quality is a domain extension: catalog data quality in small wholesalers is main risk #5 in the source (p.14). -->
<!-- Source references use the form "pdf p.N" against the single input document listed above. -->

# Gap Analysis — AI Inbox dla hurtowni instalacyjnych i elektrycznych

> This file is the source of truth across all three phases.

Kontekst: produkt przyjmuje zapytania ofertowe (zestawienia materiałowe) z wielu kanałów, wyciąga z nich pozycje, dopasowuje je do katalogu hurtowni (50–500 tys. SKU, ETIM, zamienniki, jednostki), wycenia z rabatami klienta i proponuje handlowcowi ofertę do akceptacji, a następnie zapisuje dokument OF/ZK w ERP MŚP (Subiekt, Optima, enova). Punkt wejścia: wycena zestawień z e-maila; zamówienia powtarzalne to podprzypadek tego samego potoku; telefon w drugim etapie (pdf p.12).

## Epic 1: Wielokanałowy inbox zapytań i zamówień
**Goal**: Każde zapytanie ofertowe lub zamówienie, niezależnie od kanału, trafia do jednej kolejki jako jedna sprawa przypisana do kontrahenta.
**Business value**: Hurtownie przyjmują zestawienia e-mailem i telefonicznie (pdf p.2); klient „nie zmienia kanału kontaktu” (pdf p.3), więc produkt musi obsłużyć kanały, których już używa.

#### Coverage
- negative-path: Story 1.6
- abuse-case: Story 1.8
- race-condition: Story 1.7
- tenant-isolation: Story 9.1
- data-privacy: Story 9.2
- audit-log: Story 9.3
- data-quality: Story 1.3

### Story 1.1: Odbiór zapytań e-mail z załącznikami
- **Description**: Jako handlowiec wewnętrzny chcę, żeby wiadomości ze skrzynki handlowej (np. handlowy@) trafiały do systemu razem z załącznikami, żeby nie przepisywać ich ręcznie.
- **Acceptance criteria**:
  - [ ] Wiadomości przychodzące na skonfigurowany adres są pobierane automatycznie (przekierowanie lub podłączona skrzynka)
  - [ ] Załączniki PDF, XLSX/CSV i obrazy są zapisywane i powiązane z wiadomością
  - [ ] Kolejne wiadomości z tego samego wątku e-mail są grupowane w jeden wątek
- **Source**: pdf p.2 (ELUS: „prosimy o listę towarów na handlowy@elus.pl”), pdf p.4 (wejście: e-mail z PDF/Excel/zdjęciem)
- **Priority**: P0
- **Dependencies**: none
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (2/3, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/api/webhook/inbound.ts`: public forwarding webhook (HMAC or Resend/Svix) resolving `InboxSettings.inboxAddress` and storing `InboxEmail`; carries messageId/inReplyTo/references; payload schema has no attachments
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: `InboxEmail.attachmentIds` column exists but is never written
  - `packages/channel-imap/src/modules/channel_imap/lib/imap-client.ts`: connected IMAP mailbox polling (Gmail via `packages/channel-gmail`)
  - `packages/core/src/modules/communication_channels/lib/email-mime.ts`: `normalizeAttachments` parses inbound MIME attachments
  - `packages/core/src/modules/communication_channels/commands/ingest-inbound-message.ts`: ingests inbound mail into `messages` but passes no attachments — parsed attachments are discarded
  - `packages/core/src/modules/communication_channels/lib/thread-matcher.ts`: layered thread matching (token, References/In-Reply-To, JWZ, subject+participants)
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/inbox_ops/api/webhook/inbound.ts`
  - C2: gap: inbound PDF/XLSX/CSV/image attachments are parsed but never persisted to the attachments module or linked to the message on either ingestion path
  - C3: covered `packages/core/src/modules/communication_channels/lib/thread-matcher.ts`
- **Grounding query**: `inbound attachment`
- **Grounding source**: core
- **Gaps**:
  - Attachments dropped in `ingest-inbound-message.ts` and in the inbox_ops webhook (no attachments field; `attachmentIds` never populated)
  - Threading works only on the connected-mailbox path; inbox_ops forwarding path stores each email standalone
  - Shared department mailbox (handlowy@) only specified in open PR #6293 (CHANGES_REQUESTED)
- **Effort**: 3
- **Suggested implementation path**:
  - FLAG: contribution to shared platform modules `communication_channels` / `inbox_ops`
  - Persist each non-inline attachment via the core `attachments` module and link it to the composed Message (non-draft variant of `messages.attachments.link_to_draft`)
  - Either extend the inbox_ops webhook with attachments and populate `attachmentIds`, or route handlowy@ through a connected channel and hand ingested Messages to inbox_ops (also inherits threading)
  - Align with the department-mailboxes design in PR #6293 (CHANGES_REQUESTED) before building the shared mailbox part
  - Primitives checked: queue workers, attachments, messages threads, inbox_ops ai-tools
- **Upstream pipeline**: PR #6293 (open)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 1.2: Scalanie zapytań z wielu kanałów w jedną sprawę
- **Description**: Jako handlowiec chcę, żeby wiadomości od tego samego klienta dotyczące tego samego zestawienia (e-mail, telefon, komunikator) były scalane w jedną sprawę, żeby przygotować jedną ofertę zamiast kilku.
- **Acceptance criteria**:
  - [ ] System proponuje powiązanie nowej wiadomości z istniejącą otwartą sprawą tego samego kontrahenta
  - [ ] Handlowiec może ręcznie scalić lub rozdzielić sprawy
  - [ ] Sprawa pokazuje oś czasu wiadomości ze wszystkich kanałów
- **Source**: pdf p.2 (Dynamik i Onninen przyjmują zapytania przez telefon i e-mail), pdf p.3 (nadawca nie zmienia kanału kontaktu)
- **Priority**: P1
- **Dependencies**: 1.1, 1.3
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/3, core)
- **Evidence**:
  - `packages/core/src/modules/communication_channels/lib/thread-matcher.ts`: automatic threading (token, JWZ headers, subject+participants) scoped to one `channelId`; no cross-channel matching or link suggestion
  - `packages/core/src/modules/communication_channels/data/entities.ts`: per-channel `ExternalConversation`; no cross-channel case entity
  - `packages/core/src/modules/communication_channels/commands/reassign-conversation.ts`: only reassignment, no merge/split
  - `packages/core/src/modules/customers/lib/link-channel-message-handler.ts`: projects channel messages into `CustomerInteraction` for the matched person, without `dealId`
  - `packages/core/src/modules/customers/components/detail/ActivitiesSection.tsx`: activity timeline filtered by deal or entity across call/email/meeting/note types
  - `packages/core/src/modules/phone_calls/data/entities.ts`: `communication_projection_id` exists but is never populated
- **Criteria coverage**:
  - C1: gap: nothing proposes linking a new message to an existing open case (deal) of the same customer; matching is automatic and per channel
  - C2: gap: no merge or split command/API/UI for cases; only per-interaction `dealId` edits
  - C3: covered `packages/core/src/modules/customers/components/detail/ActivitiesSection.tsx`
- **Grounding query**: `thread-matcher`
- **Grounding source**: core
- **Gaps**:
  - No suggestion engine linking inbound messages to open deals
  - No cross-channel conversation
  - No undoable merge/split commands
  - Timeline complete only with manual linking; phone calls not projected; all channel messages typed `email`
- **Effort**: 4
- **Suggested implementation path**:
  - Use `CustomerDeal` as the case and `CustomerInteraction.dealId` as membership (reuses the timeline for C3)
  - C1: extend `link-channel-message-handler.ts` to suggest open deals; reuse the inbox_ops proposal/action pattern (e.g. a "link to deal" action) — primitives checked: inbox_ops `executionEngine`, `notifications`, `business_rules`/`workflows`
  - C2: undoable `deals.merge` / `interactions.split` commands following `reassign-conversation.ts`
  - Project phone calls as `call` interactions via `communication_projection_id`; set interaction type from provider
  - FLAG: touches shared `customers`, `communication_channels`, `phone_calls`; check DRAFT PR #6744 first
- **Upstream pipeline**: PR #6744 (open)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 1.3: Identyfikacja nadawcy i klasyfikacja intencji
- **Description**: Jako handlowiec chcę, żeby system rozpoznał kontrahenta nadawcy i rodzaj wiadomości (zapytanie ofertowe, zamówienie powtarzalne, inne), żeby zastosować właściwe warunki handlowe i ścieżkę obsługi.
- **Acceptance criteria**:
  - [ ] Nadawca jest dopasowany do kontrahenta w CRM (adres e-mail, domena, numer telefonu)
  - [ ] Wiadomość jest sklasyfikowana jako zapytanie ofertowe, zamówienie lub inna, z oceną pewności
  - [ ] Nieznany nadawca trafia do kolejki z propozycją utworzenia kontrahenta
- **Source**: pdf p.1 (oferta „zgodna z warunkami przypisanymi do konkretnego klienta”), pdf p.2 (dwa odrębne bóle: zamówienia powtarzalne vs wyceny zestawień)
- **Priority**: P0
- **Dependencies**: 1.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (2/3, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/lib/contactMatcher.ts`: `matchContacts` matches participants to CRM `customer_entities` by exact `primaryEmail` (1.0) with decrypt-scan and fuzzy display-name fallbacks; no domain or phone matching
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: persists `category` and `confidence` on the proposal; unmatched senders yield `create_contact` actions and `unknown_contact` discrepancies; email set to `needs_review`
  - `packages/core/src/modules/inbox_ops/lib/extractionPrompt.ts`: LLM classifies into rfq, order, order_update, complaint, shipping_update, inquiry, payment, other with confidence 0.0–1.0
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/categorize/route.ts`: manual re-categorisation
  - `packages/core/src/modules/customers/lib/findPeopleByAddresses.ts`: CRM lookup by email only; no company-by-domain helper
- **Criteria coverage**:
  - C1: gap: sender matching by email address and fuzzy name only; no email-domain → company match and no phone-number match
  - C2: covered `packages/core/src/modules/inbox_ops/lib/extractionPrompt.ts`
  - C3: covered `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`
- **Grounding query**: `contactMatcher`
- **Grounding source**: core
- **Gaps**:
  - No domain-based company matching (`findCompaniesByDomains` does not exist)
  - No phone-number matching (needed for WhatsApp/SMS/phone channels)
  - Encrypted-tenant email matching scans only the newest 100/500 rows until the blind index lands
  - No dedicated `repeat_order` category (maps to `order`)
- **Effort**: 3
- **Suggested implementation path**:
  - FLAG: contribution to shared platform modules `customers` and `inbox_ops`
  - Land the planned blind-index spec (`customer_companies.domain_hash`, `primary_email_hash`) and add `findCompaniesByDomains`
  - Extend `contactMatcher.ts` with a domain step (free-mail blocklist, company match at lower confidence) and an E.164 phone step via `findWithDecryption`
  - Make `create_contact` generation domain-aware (propose `link_contact` to the matched company)
  - Primitives checked: `business_rules`, `workflows`, `notifications` (`proposalNotifier`) — none perform sender matching
- **Upstream pipeline**: spec: .ai/specs/2026-09-04-customers-email-domain-blind-index.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 1.4: Kanał telefoniczny — transkrypcja rozmów w propozycję
- **Description**: Jako handlowiec chcę, żeby rozmowa telefoniczna z klientem była transkrybowana i zamieniona w propozycję zamówienia lub zapytania, żeby telefon nie omijał potoku.
- **Acceptance criteria**:
  - [ ] Nagranie lub transkrypcja rozmowy jest powiązana z kontrahentem i sprawą
  - [ ] Z transkrypcji wyciągane są pozycje (nazwa, ilość, jednostka) jak z e-maila
- **Source**: pdf p.2 (dominuje telefon, którego nie da się obsłużyć tekstowym AI Inbox bez transkrypcji), pdf p.4, pdf p.12 (telefon w drugim etapie)
- **Priority**: P2
- **Dependencies**: 1.2, 2.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/phone_calls/data/entities.ts`: provider-neutral `PhoneCall` + `PhoneCallParticipant` with recording URL/attachment and participant phone; no link to customer/deal/case; `active_transcript_version_id` reserved, no transcript entity
  - `packages/core/src/modules/phone_calls/commands/calls.ts`: `phone_calls.call.ingest` upserts calls, emits `phone_calls.call.ingested`; no transcription, no customer matching
  - `packages/tillio/src/modules/tillio/lib/pull-job.ts`: only shipped provider (Tillio/Ringostat) — pulls metadata and recordings, not transcripts
  - `packages/core/src/modules/inbox_ops/api/extract/route.ts`: accepts free text, wraps it as `InboxEmail` (`source='text_extract'`) and runs the same LLM line-item extraction as email
  - `packages/core/src/modules/inbox_ops/lib/contactMatcher.ts`: matches by email/name only, not phone
- **Criteria coverage**:
  - C1: gap: calls are ingested with a recording URL but there is no transcript aggregate/STT step and no link from `PhoneCall` to a customer or case
  - C2: covered `packages/core/src/modules/inbox_ops/api/extract/route.ts`
- **Grounding query**: `phone_calls`
- **Grounding source**: core
- **Gaps**:
  - No speech-to-text step; `active_transcript_version_id` unused
  - No phone-number → CRM matching; no call → case link
  - No automatic hand-off of calls/transcripts into inbox_ops (spec Phase 4, unbuilt)
  - C2 only at email parity: line items have no unit-of-measure field
- **Effort**: 5
- **Suggested implementation path**:
  - Primitives checked: `phone_calls.call.ingested` event, inbox_ops `/api/inbox_ops/extract`, `integrations` hub + queue worker pattern (`tillio/workers/tillio-pull.ts`), `ai_assistant` — reuse the extraction engine
  - Add a transcript source (provider transcripts or an STT adapter behind `integrations`, external dependency) stored in an encrypted versioned transcript entity
  - Link calls to CRM via an extension table and phone matching; link to the case entity
  - Persistent subscriber on call/transcript-ready event submitting text into inbox_ops (`metadata.source='phone_call'`)
  - FLAG: extends core `phone_calls` and `inbox_ops` (platform contribution) — follow `.ai/specs/2026-06-09-phone-calls-core-hub-and-tillio-provider.md`
- **Upstream pipeline**: spec: .ai/specs/2026-06-09-phone-calls-core-hub-and-tillio-provider.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 1.5: Komunikatory (WhatsApp, SMS) dla zamówień powtarzalnych
- **Description**: Jako stały klient (instalator, majster) chcę wysłać krótką listę przez WhatsApp lub SMS, a hurtownia chce, żeby trafiła do tej samej kolejki co e-mail.
- **Acceptance criteria**:
  - [ ] Wiadomości WhatsApp i SMS (tekst i zdjęcia) trafiają do inboxa jako wiadomości sprawy
  - [ ] Odpowiedź do klienta może wyjść tym samym kanałem
- **Source**: pdf p.2 (zamówienia powtarzalne: telefon, SMS, WhatsApp, krótkie listy), pdf p.4 (porównanie z wersją gastronomiczną)
- **Priority**: P2
- **Dependencies**: 1.2
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/communication_channels/lib/adapter.ts`: `ChannelAdapter` contract declaring whatsapp/sms channel types — interface only
  - `packages/core/src/modules/communication_channels/api/post/webhook/[provider]/route.ts`: generic inbound webhook; no whatsapp/sms adapter registered
  - `packages/core/src/modules/communication_channels/commands/ingest-inbound-message.ts`: landing point a WhatsApp/SMS adapter would feed
  - `packages/core/src/modules/communication_channels/commands/deliver-outbound-message.ts`: generic outbound delivery path
  - `packages/channel-discord/src/modules/channel_discord`: existing chat adapter template; shipped providers are apns, discord, expo, fcm, gmail, imap, resend, ses — no WhatsApp or SMS
  - `packages/core/src/modules/inbox_ops/api/webhook/inbound.ts`: inbox_ops ingests email only
- **Criteria coverage**:
  - C1: gap: no WhatsApp or SMS adapter in core or companion, and no bridge from hub messages into the inbox_ops queue; no inbound media download
  - C2: gap: no WhatsApp/SMS `sendMessage` implementation, so replies cannot go back on those channels
- **Grounding query**: `channel_sms`
- **Grounding source**: core
- **Gaps**:
  - `channel-whatsapp` provider package (Cloud API webhook verify, normalize, media download, send, delivery status)
  - SMS provider package (e.g. Twilio or SMSAPI.pl)
  - Bridge `communication_channels` → inbox_ops
  - Inbound media persisted as attachments; reply-from-case UI
- **Effort**: 5
- **Suggested implementation path**:
  - Build adapters on the `communication_channels` hub using `packages/channel-discord` as template; follow `SPEC-056` and `ANALYSIS-045d`
  - Subscriber feeding ingested `ExternalMessage` into inbox_ops extraction; images via `attachments`
  - Replies through `deliver-outbound-message` (outbound-bridge subscriber)
  - FLAG: adapter packages and bridge belong in the platform; external dependency on Meta WhatsApp Business onboarding and an SMS gateway
- **Upstream pipeline**: spec: .ai/specs/SPEC-056-2026-02-22-whatsapp-ai-chat-integration.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 1.6: Obsługa nieprzetwarzalnych wiadomości
- **Description**: Jako handlowiec chcę widzieć wiadomości, których system nie umiał przetworzyć (nieczytelny lub nieobsługiwany załącznik, pusta treść, błąd modelu), żeby żadne zapytanie nie zginęło po cichu.
- **Acceptance criteria**:
  - [ ] Nieudane przetworzenie oznacza wiadomość statusem błędu z przyczyną, widocznym w kolejce
  - [ ] Handlowiec może ponowić przetwarzanie lub obsłużyć wiadomość ręcznie
- **Source**: pdf p.14 (ryzyko 8: handlowcy mogą nie ufać narzędziu, potrzebny interfejs propozycji do akceptacji)
- **Priority**: P1
- **Dependencies**: 1.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: `InboxEmailStatus` includes `failed` and `needs_review`; `InboxEmail.processingError` stores the reason
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: marks email `failed` with reason on empty content, LLM extraction error or exception; emits `inbox_ops.email.failed`; attachments are not parsed, so attachment-specific failures are never recorded
  - `packages/core/src/modules/inbox_ops/backend/inbox-ops/log/page.tsx`: Processing Log with Failed tab, status badge, Error column and Retry button
  - `packages/core/src/modules/inbox_ops/api/emails/[id]/reprocess/route.ts`: retry endpoint resetting status and re-emitting `inbox_ops.email.received`
  - `packages/core/src/modules/inbox_ops/api/emails/[id]/route.ts`: GET/DELETE only; no resolve/handled-manually action
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/inbox_ops/backend/inbox-ops/log/page.tsx`
  - C2: gap: retry exists, but there is no manual-handling path — no email detail view from a failed row, no "handled manually" status with actor/note, no way to create a proposal by hand from the failed email
- **Grounding query**: `processingError`
- **Grounding source**: core
- **Gaps**:
  - Manual resolution status (`handled_manually`) with actor, timestamp, note and an endpoint + log-page action
  - Failed-email detail view reachable from the Processing Log
  - Attachment-specific failure reasons (depends on attachment extraction, story 2.1)
  - No notification subscriber on `inbox_ops.email.failed`
- **Effort**: 3
- **Suggested implementation path**:
  - FLAG: changes the shared platform module `inbox_ops` (or an app-level UMES extension on the log page)
  - Add `handled_manually` status + `handledByUserId/handledAt/handledNote`, POST `api/emails/[id]/resolve` modelled on `reprocess/route.ts`, new event `inbox_ops.email.resolved`
  - Row action opening a detail drawer reusing `components/messages/InboxEmailPreview.tsx`
  - Primitive checked: `notifications` — add a subscriber on `inbox_ops.email.failed` following `subscribers/proposalNotifier.ts`
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 1.7: Idempotentne przyjmowanie wiadomości
- **Description**: Jako hurtownia chcę, żeby ta sama wiadomość dostarczona ponownie (retry webhooka, ponowna synchronizacja skrzynki) nie tworzyła drugiej sprawy ani drugiej propozycji.
- **Acceptance criteria**:
  - [ ] Wiadomość o tym samym identyfikatorze (Message-ID lub identyfikator dostawcy) jest przetwarzana tylko raz w obrębie tenanta
  - [ ] Równoległe dostarczenie tej samej wiadomości nie tworzy duplikatu
- **Source**: pdf p.3 (użytkownik pomocniczy mierzy wartość liczbą korekt i zwrotów; duplikaty ofert generują korekty)
- **Priority**: P1
- **Dependencies**: 1.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ✅ Implemented (2/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/api/webhook/inbound.ts`: `checkDuplicate()` by `messageId` then `contentHash`, scoped to organization+tenant; emits `inbox_ops.email.deduplicated` and returns 200 without creating an email or proposal
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: partial unique constraints on `(organizationId, tenantId, messageId)` and `(organizationId, tenantId, contentHash)` as the DB-level race guard
  - `packages/core/src/modules/inbox_ops/migrations/Migration20260216151619.ts`: creates the unique constraints
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: atomic `nativeUpdate` claim received → processing; redelivered events cannot create a second proposal
  - `packages/core/src/modules/inbox_ops/api/webhook/__tests__/inbound.test.ts`: unit tests for dedup by messageId and contentHash
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/inbox_ops/api/webhook/inbound.ts`
  - C2: covered `packages/core/src/modules/inbox_ops/data/entities.ts`
- **Grounding query**: `email.deduplicated`
- **Grounding source**: core
- **Gaps**:
  - none (hardening only: concurrent loser hits an uncaught unique violation and returns 500 before the provider retry is deduplicated; uniqueness is per organization, not per tenant; manual `api/extract` path has no dedup by design)
- **Effort**: 0
- **Suggested implementation path**:
  - No work required
  - Optional hardening (platform contribution): catch `UniqueConstraintViolationException`/23505 thrown by `em.flush()` in `inbound.ts` (pattern in `lib/ensure-settings.ts`), treat as deduplicated; add a concurrency test
  - Primitives checked: events (`inbox_ops.email.deduplicated` exists), persistent subscriber claim
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 1.8: Odporność na spam i wstrzykiwanie poleceń w treści wiadomości
- **Description**: Jako hurtownia chcę, żeby treść obcych wiadomości (spam, phishing, próby prompt injection) nie mogła wywołać akcji w systemie ani ERP bez akceptacji człowieka.
- **Acceptance criteria**:
  - [ ] Treść wiadomości jest traktowana jako dane; żadna mutacja nie wykonuje się bez propozycji zatwierdzonej przez człowieka lub politykę
  - [ ] Wiadomości oznaczone jako spam nie trafiają do przetwarzania AI
- **Source**: pdf p.4 (human-in-the-loop: mutacja przechodzi przez akceptację człowieka lub politykę powyżej progu pewności)
- **Priority**: P1
- **Dependencies**: 1.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/lib/extractionPrompt.ts`: `<safety>` block instructs the LLM to treat email content as untrusted data and ignore embedded instructions
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: LLM output persisted only as pending `InboxProposal`/`InboxProposalAction`; nothing executes at extraction time
  - `packages/core/src/modules/inbox_ops/lib/executionEngine.ts`: `executeAction`/`acceptAllActions` are the only mutation path
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/actions/[actionId]/accept/route.ts`: human accept gated by `inbox_ops.proposals.manage`
  - `packages/core/src/modules/inbox_ops/ai-tools.ts`: `inbox_ops_accept_action` is `isMutation: true` (ai_assistant approval card)
  - `packages/core/src/modules/inbox_ops/api/webhook/inbound.ts`: signature verification, rate limits and dedup; no spam classification
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/inbox_ops/api/proposals/[id]/actions/[actionId]/accept/route.ts`
  - C2: gap: no spam flag/status on `InboxEmail` and no filter preventing flagged emails from reaching the LLM
- **Grounding query**: `inbox_ops.proposals.manage`
- **Grounding source**: core
- **Gaps**:
  - No spam detection (provider spam headers, sender blocklist, pre-classifier) and no manual mark-as-spam
  - No worker short-circuit for spam emails
  - Prompt-injection defence is instruction-only (mitigated by mandatory human approval)
- **Effort**: 2
- **Suggested implementation path**:
  - Add `spam` status (+ optional `spamReason`/`spamScore`) in `inbox_ops/data/entities.ts`
  - Parse provider spam verdicts / `X-Spam-Flag` and a per-tenant sender blocklist in `api/webhook/inbound.ts`; do not emit the extraction event for spam
  - Manual mark as spam / not spam via `api/emails/[id]` + reprocess
  - Primitives checked: `business_rules` (blocklist rules), ai_assistant `isMutation` approval
  - FLAG: contribution to shared platform module `inbox_ops` (or an app-level interceptor before extraction)
- **Upstream pipeline**: spec: .ai/specs/enterprise/agent-orchestrator/next/gap-analysis/gap-08-guard-prompt-injection.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

## Epic 2: Ekstrakcja pozycji z zestawień
**Goal**: Z treści wiadomości i załączników powstaje lista pozycji (nazwa, ilość, jednostka, uwagi) gotowa do dopasowania.
**Business value**: Ręczna analiza zapytań wymaga przeglądania e-maili, tabel, dokumentów i zdjęć (pdf p.1); zestawienia mają setki pozycji (pdf p.2).

#### Coverage
- negative-path: Story 2.5
- abuse-case: Story 1.8
- race-condition: out-of-scope: ekstrakcja działa na niezmiennym załączniku jednej wiadomości; współbieżność edycji wyniku pokrywa Story 5.7
- tenant-isolation: Story 9.1
- data-privacy: Story 9.2
- audit-log: Story 9.3
- data-quality: Story 2.5

### Story 2.1: Ekstrakcja pozycji z PDF i treści e-maila
- **Description**: Jako handlowiec chcę, żeby zestawienie z PDF lub z treści maila zostało zamienione na listę pozycji z ilością i jednostką.
- **Acceptance criteria**:
  - [ ] Z PDF (tekstowego) i treści e-maila wyciągane są pozycje: opis, ilość, jednostka
  - [ ] Wynik jest zapisany jako ustrukturyzowane dane powiązane ze sprawą
- **Source**: pdf p.2 (wyceny zestawień: PDF lub Excel z projektu, specyfikacje, zdjęcia), pdf p.4
- **Priority**: P0
- **Dependencies**: 1.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: LLM extraction worker; reads email `rawText`/`rawHtml` and produces `create_order`/`create_quote` actions with `lineItems` persisted as `InboxProposalAction` rows
  - `packages/core/src/modules/inbox_ops/data/validators.ts`: `orderPayloadSchema.lineItems` (productName, sku, quantity, unitPrice, description, kind) — no unit-of-measure field
  - `packages/core/src/modules/inbox_ops/lib/extractionPrompt.ts`: extraction prompt; no instruction to capture unit
  - `packages/core/src/modules/inbox_ops/api/extract/route.ts`: POST endpoint accepts plain `text` only, no file/PDF
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: `InboxEmail`, `InboxProposal`, `InboxProposalAction` store structured result tied to the email/proposal; `InboxEmail.attachmentIds` column exists but is never populated or read
  - `packages/core/src/modules/attachments/lib/textExtraction.ts`: standalone PDF text extraction (pdfjs-dist) into `Attachment.content`, not wired into inbox_ops
  - `packages/core/src/modules/sales/data/entities.ts`: sales lines already carry `quantityUnit`/`normalizedUnit`
- **Criteria coverage**:
  - C1: gap: email-body line items (description, quantity) are extracted, but text PDFs are not — inbound attachments are never ingested/text-extracted into the LLM prompt, and the `lineItems` schema/prompt has no unit field
  - C2: covered `packages/core/src/modules/inbox_ops/data/entities.ts`
- **Grounding query**: `extractionWorker`
- **Grounding source**: core
- **Gaps**:
  - PDF input: `api/webhook/inbound.ts` / `lib/emailParser.ts` drop attachments; `InboxEmail.attachmentIds` never populated; `api/extract/route.ts` only accepts text
  - Unit of measure: no `unit`/`quantityUnit` in `lineItems` schema or extraction prompt; not mapped to `SalesQuoteLine.quantityUnit`
  - No standalone bill-of-materials result shape: line items live only inside `create_order`/`create_quote` action payloads
- **Effort**: 3
- **Suggested implementation path**:
  - FLAG: contributes to the shared platform module `inbox_ops` (packages/core), not app-only code
  - Persist inbound attachments via the `attachments` module (upload pipeline already extracts PDF text into `Attachment.content` via `lib/textExtraction.ts`) and populate `InboxEmail.attachmentIds`; optionally let `api/extract/route.ts` accept an attachment id/file
  - In `subscribers/extractionWorker.ts`, append extracted PDF text (bounded by `INBOX_OPS_MAX_TEXT_SIZE`) to the LLM thread text; add optional `quantityUnit` to `orderPayloadSchema.lineItems` and the prompt
  - Map `quantityUnit` into sales quote/order line creation in `lib/executionEngine.ts`; surface unit in `components/proposals/ActionCard.tsx` / `EditActionDialog.tsx`
  - Primitives checked: `attachments` (text extraction/OCR exists), `ai_assistant` (attachment-processing spec targets chat agents, not inbox_ops), queue/events already used by `extractionWorker`
  - Pipeline note: PR #6264 (bound OCR pages/timeouts) is APPROVED — hardens the attachments OCR path this plan would reuse; does not add inbox PDF ingestion
- **Upstream pipeline**: spec: .ai/specs/2026-04-27-ai-agent-attachment-processing-and-context.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 2.2: Ekstrakcja pozycji z Excela i CSV
- **Description**: Jako handlowiec chcę, żeby zestawienie w XLSX/CSV o dowolnym układzie kolumn zostało zamienione na listę pozycji.
- **Acceptance criteria**:
  - [ ] Arkusz XLSX/CSV jest parsowany, a kolumny opisu, ilości i jednostki są rozpoznawane automatycznie
  - [ ] Handlowiec może poprawić mapowanie kolumn, gdy rozpoznanie jest błędne
- **Source**: pdf p.2, pdf p.4 (e-mail z PDF/Excel/zdjęciem projektu)
- **Priority**: P0
- **Dependencies**: 1.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/sync_excel/lib/parser.ts`: CSV-only parser (no XLSX)
  - `packages/core/src/modules/sync_excel/lib/column-detector.ts`: header-alias detection for customer/person fields only
  - `packages/core/src/modules/sync_excel/widgets/injection/upload-config/widget.client.tsx`: mapping correction UI for the customers import only
  - `packages/core/src/modules/attachments/lib/textExtraction.ts`: XLSX explicitly unsupported (returns null)
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: `attachmentIds` stored but never read by extraction
- **Criteria coverage**:
  - C1: gap: no XLSX parsing and no sheet → line-item conversion; no description/quantity/unit column detector; not connected to inbox_ops attachments
  - C2: gap: no column-mapping correction for line-item extraction (only the customers-import mapping editor exists)
- **Grounding query**: `spreadsheet line item`
- **Grounding source**: core
- **Gaps**:
  - XLSX reading (needs a new spreadsheet dependency)
  - Line-item column detector with PL/EN aliases (opis/nazwa/indeks, ilość/qty, jm/jednostka/unit)
  - inbox_ops attachment → line-item path
  - Mapping-correction panel in the proposal/quote flow
- **Effort**: 4
- **Suggested implementation path**:
  - FLAG: contribution to shared modules (`attachments`, `inbox_ops`, possibly `sync_excel`)
  - XLSX → `{ headers, rows }` helper next to `sync_excel/lib/parser.ts` (external dependency, e.g. exceljs)
  - Line-item detector modelled on `sync_excel/lib/column-detector.ts`, with LLM fallback via `inbox_ops/lib/llmProvider.ts`
  - Wire XLSX/CSV attachments into inbox_ops proposals and `catalogLookup.ts`; mapping panel reusing the sync_excel mapping-row editor
  - Primitives checked: `data_sync` (entity imports, not a fit), `attachments` text extraction, ai-assistant/inbox_ops LLM extraction
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 2.3: Ekstrakcja pozycji ze zdjęć i skanów
- **Description**: Jako handlowiec chcę, żeby zdjęcie odręcznej listy lub skan specyfikacji zostały zamienione na listę pozycji.
- **Acceptance criteria**:
  - [ ] Obrazy (JPG, PNG) i skany PDF są przetwarzane modelem wizyjnym lub OCR na listę pozycji
  - [ ] Pozycje z obrazu mają ocenę pewności odczytu
- **Source**: pdf p.1 (ból przy wycenie zestawień ze zdjęć), pdf p.8 (AiGrodno: tekst, zdjęcia, wizja komputerowa)
- **Priority**: P1
- **Dependencies**: 2.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/attachments/lib/ocrService.ts`: LLM-vision OCR (hardcoded OpenAI gpt-4o) for images and PDFs producing unstructured markdown, no confidence
  - `packages/core/src/modules/attachments/lib/ocrQueue.ts`: fire-and-forget `setImmediate` OCR trigger writing `attachments.content`
  - `packages/ai-assistant/src/modules/ai_assistant/lib/attachment-parts.ts`: image/PDF attachments as multimodal parts for AI agents
  - `packages/ai-assistant/src/modules/ai_assistant/lib/agent-runtime.ts`: `runAiAgentObject` structured output from multimodal input — building block, unused for line items
  - `packages/core/src/modules/inbox_ops/data/validators.ts`: `lineItems` without per-line confidence; inbox_ops extraction ignores attachments
- **Criteria coverage**:
  - C1: gap: images/scans can be OCR'd to free text, but nothing turns them into a structured list of line items; inbox_ops ignores `attachmentIds`
  - C2: gap: no per-line read-confidence score for items read from an image
- **Grounding query**: `imageLineItem`
- **Grounding source**: core
- **Gaps**:
  - Image/scan → structured line items step (productName, sku, quantity, unit, rawText)
  - Per-line `readConfidence` and UI flagging of low-confidence rows
  - inbox_ops does not feed attachments or their OCR content into extraction
  - OCR locked to gpt-4o, no retry/status; open PR #6264 (APPROVED) and PR #6435 (DRAFT) only harden OCR limits
- **Effort**: 3
- **Suggested implementation path**:
  - Primitives checked: `ai_assistant` (`runAiAgentObject`, `acceptedMediaTypes`), `attachments` (`OcrService`), inbox_ops enrichment (`catalogLookup`, `priceValidator`), `packages/queue`
  - Structured-object AI agent (`ai-agents.ts`, media types image/pdf) with a Zod line-item schema including `readConfidence`
  - Feed items through inbox_ops enrichment; show `readConfidence` per row in review
  - FLAG: feeding attachments into `extractionWorker.ts` and adding per-line confidence is a contribution to the shared `inbox_ops` module; rebase on PR #6264 (APPROVED) for OCR limits
- **Upstream pipeline**: spec: .ai/specs/enterprise/agent-orchestrator/next/gap-analysis/gap-06-document-ingest-ocr.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 2.4: Import zestawień z programów kosztorysowych
- **Description**: Jako hurtownia chcę przyjąć zestawienie wyeksportowane z programu kosztorysowego (Norma, Zuzia, Rodos), żeby nie przepisywać go z wydruku.
- **Acceptance criteria**:
  - [ ] Eksport z programu kosztorysowego (np. ATH lub XML) jest importowany jako lista pozycji
- **Source**: pdf p.11 (kosztorysowanie: import zestawień z tych programów jako funkcja)
- **Priority**: P2
- **Dependencies**: 2.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/1)
- **Evidence**:
  - `packages/core/src/modules/sync_excel/lib/parser.ts`: only file-import parser; CSV only, no ATH or estimate XML reader
  - `packages/core/src/modules/sync_excel/lib/adapters/customers.ts`: only adapter, supports `customers.person`
  - `packages/core/src/modules/data_sync/lib/adapter.ts`: generic import run framework a new adapter could plug into
  - `packages/core/src/modules/sales/api/quote-lines`: target API for imported lines
- **Criteria coverage**:
  - C1: gap: no parser/importer for estimating-software exports (ATH or kosztorys XML from Norma/Zuzia/Rodos) and no path from such a file to line items
- **Grounding query**: `kosztorys`
- **Grounding source**: core
- **Gaps**:
  - ATH (sectioned INI-like text, cp1250) and kosztorys XML parsers
  - Mapping estimate positions (description, unit, quantity, KNR code) to catalog products or free-text lines
  - Upload UI / import flow creating a quote or line list
- **Effort**: 4
- **Suggested implementation path**:
  - App-level module (e.g. `estimate_import`) with ATH and XML parsers normalised to `{ description, unit, quantity, code }[]`
  - Reuse `data_sync` run/queue/progress primitives and the `sync_excel` upload/mapping pattern
  - Resolve items with the story 3.x matching logic; keep unmatched positions as free-text lines
  - Create results via sales commands behind `sales/api/quote-lines`; attach upload UI via widget injection on the quote page
  - FLAG: only if built as a generic sync_excel adapter would it be a platform contribution
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 2.5: Pozycje niepewne i nieczytelne
- **Description**: Jako handlowiec chcę, żeby pozycje odczytane z niską pewnością (nieczytelna ilość, brak jednostki) były wyraźnie oznaczone, a nie zgadywane.
- **Acceptance criteria**:
  - [ ] Każda wyekstrahowana pozycja ma ocenę pewności; poniżej progu jest oznaczona do weryfikacji
  - [ ] Brak ilości lub jednostki nie jest uzupełniany wartością domyślną bez oznaczenia
- **Source**: pdf p.3 (użytkownik pomocniczy: błędne pozycje i jednostki, ponowne kursy), pdf p.4 (zatwierdzanie pozycji o niskiej pewności)
- **Priority**: P1
- **Dependencies**: 2.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/data/validators.ts`: `lineItems` has no per-line confidence, no unit field and no review flag; confidence exists only per action and per proposal
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: `INBOX_OPS_CONFIDENCE_THRESHOLD` compared only against proposal-level confidence, flagging the whole email `needs_review`
  - `packages/core/src/modules/inbox_ops/components/proposals/ActionCard.tsx`: `ConfidenceBadge` per action/proposal; line table shows quantity as a plain value
  - `packages/core/src/modules/inbox_ops/lib/extractionPrompt.ts`: no instruction to score lines or flag missing quantity/unit
  - `packages/core/src/modules/inbox_ops/lib/payloadEnrichment.ts`: no line completeness checks
- **Criteria coverage**:
  - C1: gap: no per-line confidence score and no per-line "to verify" flag below a threshold
  - C2: gap: no unit field; `quantity` is required with no explicit missing-quantity/unit marker, so values can be guessed silently
- **Grounding query**: `line_item_confidence`
- **Grounding source**: core
- **Gaps**:
  - Per-line `confidence` + `uncertainFields` flag against a configurable threshold
  - Unit field on extracted lines (catalog/sales UoM exists but inbox_ops ignores it)
  - Discrepancy types `missing_quantity`, `missing_unit`, `low_confidence_line`
  - UI highlighting and an accept guard for unresolved lines
- **Effort**: 3
- **Suggested implementation path**:
  - FLAG: contribution to shared platform module `inbox_ops`
  - Extend `orderPayloadSchema.lineItems` with optional `confidence`, `unit`, `uncertainFields`; make `quantity` optional-with-flag; update the prompt
  - Emit per-line discrepancies in `extractionWorker.ts` (pattern of `validatePrices`/`detectDuplicateOrders`), force `needs_review`
  - Highlight lines in `ActionCard` and block accept until resolved; primitives checked: discrepancy + `needs_review` flow, `proposalNotifier` (no business_rules/workflows needed)
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 2.6: Przetwarzanie dużych zestawień w tle
- **Description**: Jako handlowiec chcę, żeby zestawienie z setkami pozycji przetwarzało się w tle z widocznym postępem, bez blokowania pracy.
- **Acceptance criteria**:
  - [ ] Ekstrakcja i dopasowanie dużego zestawienia działają jako zadanie w tle (kolejka)
  - [ ] Postęp zadania jest widoczny w interfejsie
- **Source**: pdf p.2 (setki pozycji, zamienniki, rabaty indywidualne)
- **Priority**: P1
- **Dependencies**: 2.1, 3.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: persistent subscriber `inbox_ops:extraction-worker` on `inbox_ops.email.received`; LLM extraction, catalog/contact matching, price validation and proposal creation run off the request path; status received → processing → processed/needs_review/failed
  - `packages/core/src/modules/inbox_ops/api/extract/route.ts`: returns `{ ok, emailId }` immediately; extraction is asynchronous; no `progressJobId`
  - `packages/events/src/bus.ts`: persistent emits go through the durable `@open-mercato/queue` events queue
  - `packages/core/src/modules/inbox_ops/lib/catalogLookup.ts`: `MAX_CATALOG_PRODUCTS = 50`; one LLM pass per document, no chunking for hundreds of lines
  - `packages/core/src/modules/progress/lib/progressService.ts`: platform ProgressJob service with `ProgressTopBar`; not used by inbox_ops
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`
  - C2: gap: extraction creates no `ProgressJob` and returns no `progressJobId`; UI shows only a coarse status badge, no item-level progress in ProgressTopBar
- **Grounding query**: `inbox_ops:extraction-worker`
- **Grounding source**: core
- **Gaps**:
  - No ProgressJob integration in extract route, inbound webhook, reprocess route or worker
  - Single LLM pass with a 50-product catalog context; no batching of large bills of materials (overlaps stories 2.1 and 3.1)
  - Job is not cancellable
- **Effort**: 3
- **Suggested implementation path**:
  - Primitives checked: `progress` (ProgressService + ProgressTopBar), `@open-mercato/queue`, persistent subscribers — reuse; follow `packages/core/src/modules/progress/AGENTS.md` and `catalog/workers/catalog-product-bulk-delete.ts`
  - Create a `inbox_ops.extraction` job in extract/webhook/reprocess routes, pass `progressJobId` in the event payload; `startJob`/`updateProgress`/`completeJob`/`failJob` in the worker per phase or per chunk
  - Chunk extraction and matching (N lines per LLM call, catalog lookup per chunk)
  - FLAG: contribution to shared platform module `inbox_ops`
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

## Epic 3: Silnik dopasowania produktów do katalogu
**Goal**: Każda pozycja zestawienia dostaje top-3 propozycji produktu z katalogu hurtowni, z przeliczoną jednostką i oceną pewności.
**Business value**: Źródło nazywa to „krytyczną pracą własną” (pdf p.4); kryterium walidacji to ≥80% trafień w top-3 i ≥60% w top-1 (pdf p.13).

#### Coverage
- negative-path: Story 3.7
- abuse-case: out-of-scope: silnik tylko czyta katalog tenanta i zwraca propozycje; nie wykonuje mutacji, więc nie ma powierzchni nadużycia poza Story 1.8
- race-condition: out-of-scope: dopasowanie jest odczytem; zmiana katalogu w trakcie wyceny jest obsłużona na poziomie ceny i stanu w Story 4.5
- tenant-isolation: Story 9.1
- data-privacy: out-of-scope: katalog produktów i cenniki nie zawierają danych osobowych
- audit-log: Story 9.3
- data-quality: Story 7.4

### Story 3.1: Wyszukiwanie produktów po nazwach potocznych w dużym katalogu
- **Description**: Jako handlowiec chcę, żeby pozycja opisana nazwą potoczną lub skrótem („kolano 90 fi 20 PP”) znajdowała właściwe produkty w katalogu 50–500 tys. SKU.
- **Acceptance criteria**:
  - [ ] Wyszukiwanie łączy dopasowanie tekstowe (pełnotekstowe) i semantyczne (wektorowe) po nazwie, indeksie, EAN i kodzie producenta
  - [ ] Wyszukiwanie działa na katalogu rzędu setek tysięcy SKU w czasie akceptowalnym dla interaktywnej wyceny
- **Source**: pdf p.2 (SBS ponad 400 tys. produktów, Onninen 500 tys., Grodno ponad 500 tys.), pdf p.4 (50–500 tys. SKU)
- **Priority**: P0
- **Dependencies**: 2.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/search/src/service.ts`: SearchService runs fulltext, vector and token strategies and merges with Reciprocal Rank Fusion
  - `packages/search/src/lib/merger.ts`: RRF merge with per-strategy weights
  - `packages/search/src/strategies/fulltext.strategy.ts`: Meilisearch-backed `FullTextSearchStrategy`
  - `packages/search/src/strategies/vector.strategy.ts`: vector strategy with pgvector/qdrant/chromadb drivers
  - `packages/core/src/modules/catalog/search.ts`: indexes products (title, subtitle, description, sku, handle, custom fields) and variants (name, sku, barcode)
  - `packages/core/src/modules/catalog/api/products/route.ts`: product list search uses `$ilike '%term%'`, not the hybrid engine
  - `packages/core/src/modules/sales/components/documents/LineItemDialog.tsx`: quote-line product picker calls the ILIKE path
- **Criteria coverage**:
  - C1: covered `packages/search/src/service.ts`
  - C2: gap: the interactive quote-line picker uses unindexed ILIKE on `/api/catalog/products`; no pg_trgm index and no benchmark at hundreds of thousands of SKUs
- **Grounding query**: `FullTextSearchStrategy`
- **Grounding source**: core
- **Gaps**:
  - Quote/order line picker does not use hybrid search (no semantic ranking for colloquial queries)
  - No proven interactive latency at 50k–500k SKUs (sequential-scan ILIKE; no load test)
  - No dedicated manufacturer-code field (single variant `barcode` typed as one GTIN)
  - Hybrid search requires Meilisearch + vector store + embedding provider, not on by default
- **Effort**: 3
- **Suggested implementation path**:
  - Reuse `searchService` (primitive checked) following `catalog.search_products` in `catalog/ai-tools/merchandising-pack.ts`
  - Add a hybrid lookup mode/endpoint for catalog products and point `LineItemDialog.tsx` at it — FLAG: platform contribution to catalog/sales; coordinate with PR #6486 on the same route
  - Manufacturer code as an indexed catalog custom field (seed/config) or a first-class field upstream
  - Provision Meilisearch + pgvector/qdrant, bulk-index via `packages/search/src/queue`, load test with 500k synthetic SKUs
- **Upstream pipeline**: PR #6486 (open)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 3.2: Dopasowanie po atrybutach ETIM
- **Description**: Jako handlowiec chcę, żeby dopasowanie uwzględniało klasę i cechy ETIM (średnica, materiał, moc), a nie tylko nazwę.
- **Acceptance criteria**:
  - [ ] Produkty w katalogu mogą mieć klasę ETIM i wartości cech
  - [ ] Parametry wyciągnięte z pozycji (np. średnica, kąt) są porównywane z cechami ETIM kandydatów
- **Source**: pdf p.4 (wyszukiwanie po atrybutach ETIM), pdf p.12 (hurtownie elektryczne: najdojrzalszy ETIM)
- **Priority**: P0
- **Dependencies**: 3.1, 7.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/catalog/data/entities.ts`: `CatalogProduct.customFieldsetCode` assigns one custom fieldset per product — a fieldset can model an ETIM class and its custom fields the feature values
  - `packages/core/src/modules/entities/lib/fieldsets.ts`: generic fieldset engine
  - `packages/sync-akeneo/src/modules/sync_akeneo/lib/catalog-importer.ts`: merged example mapping external PIM families/attributes onto fieldsets and custom fields
  - `packages/core/src/modules/catalog/ai-tools/merchandising-pack.ts`: `catalog.get_attribute_schema` exposes attribute schema; `catalog.search_products` has no attribute filter
  - `packages/core/src/modules/inbox_ops/lib/catalogLookup.ts`: candidate lookup passes only id/title/sku/price
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/catalog/data/entities.ts`
  - C2: gap: no extraction of technical parameters from line items and no comparison with candidates' feature/custom-field values
- **Grounding query**: `get_attribute_schema`
- **Grounding source**: core
- **Gaps**:
  - C1 only via configuration: no ETIM-specific model (EC/EF/EV/EU codes, ETIM version, units) and no ETIM/BMEcat importer
  - Extraction output has no per-line attributes
  - No attribute-aware candidate scoring or unit normalisation (DN50 vs 50 mm, kW vs W)
  - `catalog.search_products` cannot filter by feature values
- **Effort**: 4
- **Suggested implementation path**:
  - ETIM classes as fieldsets and features as typed custom fields; ETIM/BMEcat import worker modelled on `sync-akeneo` `catalog-importer.ts`, run via `data_sync`/`integrations` with `progress` (external data source dependency)
  - Extend inbox_ops extraction with `attributes: [{ name, value, unit }]` informed by `catalog.get_attribute_schema`
  - Attribute-aware scorer loading values via `loadCustomFieldValues` with unit normalisation — FLAG: changes to `catalogLookup.ts` / `catalog.search_products` are platform contributions
  - Primitives checked: `search`, ai-assistant catalog tools, `data_sync`/`integrations`, `business_rules`
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 3.3: Zamienniki między markami
- **Description**: Jako handlowiec chcę dostać propozycję zamiennika innej marki, gdy żądanego produktu nie ma w katalogu lub na stanie.
- **Acceptance criteria**:
  - [ ] Katalog przechowuje powiązania zamienników między produktami różnych marek
  - [ ] Dopasowanie proponuje zamiennik oznaczony jako zamiennik, gdy oryginał jest niedostępny
- **Source**: pdf p.2 (zamienniki), pdf p.4 (zamienniki między markami, sugestie zamienników)
- **Priority**: P1
- **Dependencies**: 3.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/catalog/data/types.ts`: `CATALOG_PRODUCT_RELATION_TYPES = ['bundle', 'grouped']` — no substitute relation
  - `packages/core/src/modules/catalog/data/entities.ts`: `CatalogProductVariantRelation` only for bundle/grouped; no brand/manufacturer field
  - `packages/core/src/modules/inbox_ops/lib/catalogLookup.ts`: no substitute fallback for unmatched lines
  - `packages/core/src/modules/wms/lib/inventoryPolicy.ts`: stock data exists but does not trigger substitutes
  - `packages/core/src/modules/catalog/ai-tools/products-pack.ts`: no substitute lookup tool
- **Criteria coverage**:
  - C1: gap: no entity or relation storing cross-brand substitute links; no brand attribute
  - C2: gap: no matching step proposing a flagged substitute when the original is missing or out of stock
- **Grounding query**: `substitute product`
- **Grounding source**: core
- **Gaps**:
  - Substitute relation in the data model plus brand attribute
  - Admin UI/CRUD for substitute links
  - Fallback to substitutes on no match or zero availability, with an `isSubstitute` flag on proposed lines
- **Effort**: 3
- **Suggested implementation path**:
  - App-level extension entity `product_substitutes` linked via `data/extensions.ts`/`defineLink`; brand as catalog custom field; CRUD with `makeCrudRoute` and a product-form injection widget
  - Substitute resolver after matching, reading WMS availability soft-optionally (`tryResolve`); mark lines `isSubstitute` with `originalProductRef`
  - Read-only `find_substitutes` AI tool via `defineAiTool`
  - FLAG: extending `CATALOG_PRODUCT_RELATION_TYPES` would change a core contract (platform contribution); primitives checked: catalog relations, inbox_ops catalogLookup, wms, ai-assistant tool packs, search
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 3.4: Przeliczniki jednostek
- **Description**: Jako handlowiec chcę, żeby ilość z zapytania w jednej jednostce (m², mb) była przeliczona na jednostkę sprzedaży (paczka, paleta, krąg, szt.) z zaokrągleniem do opakowania.
- **Acceptance criteria**:
  - [ ] Produkt ma zdefiniowane przeliczniki między jednostką bazową a jednostkami sprzedaży
  - [ ] Ilość z pozycji jest przeliczana na jednostkę sprzedaży i zaokrąglana do pełnego opakowania
- **Source**: pdf p.4 (przeliczniki m² → paczki → palety, mb, kręgi, szt.), pdf p.10 (platformy B2B: przeliczniki m² → rolki/palety)
- **Priority**: P0
- **Dependencies**: 3.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/catalog/data/entities.ts`: `CatalogProduct.defaultUnit`, `defaultSalesUnit`, `defaultSalesUnitQuantity`, `uomRoundingScale`, `uomRoundingMode`; `CatalogProductUnitConversion` (table `catalog_product_unit_conversions`) stores `unitCode` + `toBaseFactor` per product
  - `packages/core/src/modules/catalog/api/product-unit-conversions/route.ts`: CRUD API for conversions
  - `packages/core/src/modules/catalog/components/products/ProductUomSection.tsx`: product form UI for base/sales units and factors
  - `packages/core/src/modules/sales/commands/documents.ts`: converts sales unit → base unit only (`× toBaseFactor`) with fixed half-up decimal rounding; no inverse conversion, no ceil to whole package; `uomRoundingMode` not applied
  - `packages/core/src/modules/sales/components/documents/LineItemDialog.tsx`: pre-fills default sales unit/quantity only
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/catalog/data/entities.ts`
  - C2: gap: no conversion from a requested unit (m², mb) to the sales unit (package, pallet, coil, piece) and no rounding up to full packages; inbox_ops extraction ignores UoM
- **Grounding query**: `product_unit_conversions`
- **Grounding source**: core
- **Gaps**:
  - Inverse conversion helper (requested qty+unit → base → sales-unit qty)
  - Ceil rounding to whole packages (optionally cascading package → pallet); honour `uomRoundingMode`
  - Wiring into inbox_ops proposal line creation and `LineItemDialog`
- **Effort**: 3
- **Suggested implementation path**:
  - Pure helper in `packages/core/src/modules/catalog/lib/` (next to `unitResolution.ts`) returning original qty, rounded qty and overflow, reusing the `SalesLineUomSnapshot` shape
  - Call it from the inbox_ops quote/order draft path; keep the requested quantity in the UoM snapshot for audit
  - Optional requested-quantity input with preview in `LineItemDialog.tsx`
  - Primitives checked: `business_rules`, `workflows`, catalog/inbox_ops ai-tools — none provide UoM math
  - FLAG: helper and rounding enforcement are contributions to shared `catalog`/`sales` modules
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 3.5: Top-3 propozycji z oceną pewności
- **Description**: Jako handlowiec chcę dla każdej pozycji zobaczyć do trzech kandydatów z oceną pewności, żeby szybko wybrać właściwy.
- **Acceptance criteria**:
  - [ ] Dla każdej pozycji zwracane są maksymalnie 3 kandydaty uszeregowane według pewności
  - [ ] Ocena pewności jest zapisana i może sterować auto-akceptacją
- **Source**: pdf p.13 (kryterium: ≥80% pozycji poprawnie dopasowanych w top-3, ≥60% w top-1)
- **Priority**: P0
- **Dependencies**: 3.1, 3.2
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/lib/payloadEnrichment.ts`: resolves each line to a single product by first-match exact/substring name/SKU; no ranked list, no per-line confidence
  - `packages/core/src/modules/inbox_ops/lib/catalogLookup.ts`: sends only the 50 most recently updated products to the LLM; no candidate retrieval or scoring
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: `confidence` only on `InboxProposal` and `InboxProposalAction`
  - `packages/core/src/modules/inbox_ops/components/proposals/ActionCard.tsx`: `ConfidenceBadge` per action, not per candidate
  - `packages/search/src/strategies/vector.strategy.ts`: search primitive that could supply ranked candidates
- **Criteria coverage**:
  - C1: gap: no retrieval of up to 3 ranked product candidates per line; payload holds a single `productId`
  - C2: gap: no per-line/per-candidate confidence stored; the threshold only flags the email `needs_review`; no confidence-driven auto-accept
- **Grounding query**: `matchCandidates`
- **Grounding source**: core
- **Gaps**:
  - Candidate retrieval service (SKU/EAN exact, fuzzy name, vector similarity) returning top 3 with 0–1 scores
  - Line payload extension (`candidates: [{productId, score, reason}]`) and stored chosen-candidate confidence
  - Per-tenant auto-accept threshold (today an env var affecting status only)
  - UI listing 3 candidates with badges and a pick action
- **Effort**: 4
- **Suggested implementation path**:
  - Replace first-match in `lib/payloadEnrichment.ts` with a resolver on `packages/search` strategies plus exact SKU match (search primitive checked)
  - Store `candidates` and `matchConfidence` in `InboxProposalAction.payload` (jsonb, no new table)
  - Tenant auto-accept threshold in inbox_ops settings; consider `business_rules`/`workflows` as the policy hook before a custom subscriber
  - Extend `ActionCard.tsx`/`EditActionDialog.tsx` to list and swap candidates
  - FLAG: contribution to shared platform module `inbox_ops`
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 3.6: Uczenie z korekt handlowca
- **Description**: Jako hurtownia chcę, żeby wybór handlowca (inny kandydat niż top-1) był zapamiętywany jako mapowanie nazwy klienta na produkt i poprawiał kolejne dopasowania.
- **Acceptance criteria**:
  - [ ] Korekta handlowca zapisuje mapowanie „opis pozycji (i kontrahent) → produkt”
  - [ ] Zapisane mapowania podnoszą pozycję produktu w kolejnych dopasowaniach
- **Source**: pdf p.3 (użytkownik główny: godziny na szukaniu indeksów, zamienników i rabatów)
- **Priority**: P2
- **Dependencies**: 3.5, 5.2
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/lib/payloadEnrichment.ts`: stateless first-hit substring/SKU matching; no ranking, no lookup of past corrections
  - `packages/core/src/modules/inbox_ops/lib/catalogLookup.ts`: 50 most recently updated products to the LLM; no alias table
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/actions/[actionId]/route.ts`: PATCH edits one action's payload; nothing persisted for reuse
  - `packages/core/src/modules/inbox_ops/lib/executionHelpers.ts`: `resolveProductDiscrepanciesInProposal` sets `productId` within the current proposal only
  - `packages/core/src/modules/inbox_ops/events.ts`: `inbox_ops.action.edited` event a learning subscriber could use
- **Criteria coverage**:
  - C1: gap: salesperson corrections do not persist a "line description (+ customer) → product" mapping; no alias entity exists
  - C2: gap: matching never consults saved mappings; no candidate ranking to boost
- **Grounding query**: `productAlias`
- **Grounding source**: core
- **Gaps**:
  - Tenant/org-scoped product alias entity (normalized text, optional customer, product, use count)
  - Capture step on action edit / discrepancy resolution
  - Alias lookup in matching and in the LLM catalog context; ranking depends on story 3.5
- **Effort**: 3
- **Suggested implementation path**:
  - `InboxProductAlias` (or catalog-owned `CatalogProductAlias`) entity + migration — FLAG: platform contribution unless built as an app module extending inbox_ops
  - Persistent subscriber on `inbox_ops.action.edited` diffing `lineItems[].productId`, plus hook in `resolveProductDiscrepanciesInProposal`
  - Consult aliases (customer-specific first) in `payloadEnrichment.ts` and feed top aliases into `catalogLookup.ts`/prompt
  - Primitives checked: event bus/subscribers (fit), `business_rules`/`workflows` (no fit), integrations external-id mapping (maps IDs, not free text)
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 3.7: Pozycja bez dopasowania
- **Description**: Jako handlowiec chcę, żeby pozycja bez sensownego kandydata była oznaczona jako nieznaleziona, a nie dopasowana na siłę.
- **Acceptance criteria**:
  - [ ] Poniżej minimalnego progu pewności pozycja ma status „brak dopasowania”
  - [ ] Handlowiec może ręcznie wyszukać i przypisać produkt lub dodać pozycję spoza katalogu
- **Source**: pdf p.14 (ryzyko 5: bez ETIM i danych producentów dopasowanie spada)
- **Priority**: P1
- **Dependencies**: 3.5
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: lines without `productId` get a `product_not_found` discrepancy (error) and an auto-proposed `create_product` action; confidence threshold is proposal-level only
  - `packages/core/src/modules/inbox_ops/lib/payloadEnrichment.ts`: exact/substring matching with no score or minimum threshold — weak substring hits can force a match
  - `packages/core/src/modules/inbox_ops/components/proposals/EditActionDialog.tsx`: order/quote payloads editable only as raw JSON; no product picker
  - `packages/core/src/modules/sales/inbox-actions.ts`: unmatched lines become non-catalog lines on execution
  - `packages/core/src/modules/sales/components/documents/LineItemDialog.tsx`: catalog/custom line modes with product search on the resulting document
- **Criteria coverage**:
  - C1: gap: no per-line match confidence or minimum threshold giving an explicit "no match" status; substring enrichment can force weak matches
  - C2: covered `packages/core/src/modules/sales/components/documents/LineItemDialog.tsx`
- **Grounding query**: `product_not_found`
- **Grounding source**: core
- **Gaps**:
  - Per-line `matchConfidence`/`matchStatus` and a configurable match threshold
  - Scored matching replacing bidirectional substring matching
  - Product picker for unmatched lines inside proposal review (today only after conversion)
- **Effort**: 3
- **Suggested implementation path**:
  - FLAG: contribution to platform module `inbox_ops`
  - Add `matchConfidence`/`matchStatus` to line items; scored matching in `payloadEnrichment.ts` with `no_match` below threshold, reusing the `product_not_found` path
  - Line-item editor with catalog lookup (search module) and "keep as custom line" in `EditActionDialog.tsx`
  - Resolve discrepancies on manual assignment following `resolveProductDiscrepanciesInProposal`
  - Primitives checked: `search`; `business_rules`/`workflows` not needed
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

## Epic 4: Ceny, rabaty i dostępność
**Goal**: Propozycja oferty ma ceny zgodne z warunkami konkretnego klienta i informację o dostępności w oddziałach.
**Business value**: Oferta musi być „zgodna z warunkami przypisanymi do konkretnego klienta” (pdf p.1); rabaty indywidualne to jeden z głównych kosztów czasu handlowca (pdf p.3).

#### Coverage
- negative-path: Story 4.4
- abuse-case: out-of-scope: ceny są wyliczane po stronie serwera z danych tenanta; klient końcowy nie ma dostępu do edycji cenników
- race-condition: Story 4.5
- tenant-isolation: Story 9.1
- data-privacy: out-of-scope: warunki handlowe są danymi firmowymi kontrahenta, nie osobowymi; dostęp kontroluje Story 9.5
- audit-log: Story 9.3
- data-quality: Story 4.4

### Story 4.1: Rabaty indywidualne klienta na grupy producenta
- **Description**: Jako handlowiec chcę, żeby cena w propozycji uwzględniała rabat klienta przypisany do grupy producenta lub grupy towarowej.
- **Acceptance criteria**:
  - [ ] Kontrahent może mieć rabaty procentowe przypisane do producenta lub grupy towarowej
  - [ ] Wycena pozycji stosuje właściwy rabat klienta automatycznie
- **Source**: pdf p.4 (rabaty indywidualne na grupy producenta)
- **Priority**: P0
- **Dependencies**: 1.3
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/catalog/lib/pricing.ts`: resolver picks one absolute unit-price row keyed by customer, customer group, user, channel, quantity or date; no percentage discount, no manufacturer/category dimension; `registerCatalogPricingResolver` extension point
  - `packages/core/src/modules/catalog/data/entities.ts`: `CatalogProductPrice.customer_id`/`customer_group_id` for fixed prices; no manufacturer/brand field on products
  - `packages/core/src/modules/sales/components/documents/LineItemDialog.tsx`: `loadPrices` calls `/api/catalog/prices` without customer context
  - `packages/core/src/modules/sales/lib/calculations.ts`: `registerSalesLineCalculator` hook; `discountPercent` is manual only
- **Criteria coverage**:
  - C1: gap: no entity/UI for customer percentage discounts per manufacturer or product group; no manufacturer attribute on products
  - C2: gap: line pricing applies no customer discount automatically; the line dialog does not pass the customer when loading prices
- **Grounding query**: `manufacturerDiscount`
- **Grounding source**: core
- **Gaps**:
  - Manufacturer/brand attribute on products
  - Customer discount-rule entity (customer, scope manufacturer|category, percent, validity) with CRUD, ACL and customer-page UI
  - Automatic application on quote/order lines; customer context in line pricing
  - No customer-group entity in customers
- **Effort**: 4
- **Suggested implementation path**:
  - Primitives checked: catalog pricing resolver chain, `catalog.pricing.resolve.before`, `registerSalesLineCalculator`, `business_rules` (no line-pricing action)
  - Manufacturer as a dictionary-backed custom field in the app module; categories via `CatalogProductCategory`
  - App module `customer_discounts` with `CustomerDiscountRule` + commands, routes, ACL, widget on customer detail
  - `registerSalesLineCalculator` hook setting `discountPercent` server-side from the most specific rule
  - FLAG: passing customer context from `LineItemDialog` is a contribution to shared `sales`; align with the planned pricing-engine spec
- **Upstream pipeline**: spec: .ai/specs/2026-08-21-pricing-engine.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 4.2: Ceny projektowe
- **Description**: Jako handlowiec chcę zastosować cenę projektową uzgodnioną dla konkretnej inwestycji lub projektu, nadrzędną wobec cennika klienta.
- **Acceptance criteria**:
  - [ ] Cena projektowa jest przypisana do kontrahenta i projektu, z okresem ważności
  - [ ] Wycena wybiera cenę projektową, gdy zapytanie dotyczy danego projektu
- **Source**: pdf p.4 (ceny projektowe)
- **Priority**: P1
- **Dependencies**: 4.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/catalog/data/entities.ts`: `CatalogProductPrice` supports `customerId`, `customerGroupId`, `channelId`, `startsAt`/`endsAt`, `metadata`; no project dimension
  - `packages/core/src/modules/catalog/lib/pricing.ts`: `PricingContext` has no project key; `registerCatalogPricingResolver` resolver chain is the extension point
  - `packages/core/src/modules/catalog/services/catalogPricingService.ts`: DI pricing service with `catalog.pricing.resolve.before/after` events
  - `packages/core/src/modules/sales/data/entities.ts`: quotes/orders carry no project reference
- **Criteria coverage**:
  - C1: gap: no project/investment entity and no project dimension on price rows (customer + validity exist, project does not)
  - C2: gap: pricing context and quotes have no project key, so a project price cannot override the customer price list
- **Grounding query**: `projectPrice`
- **Grounding source**: core
- **Gaps**:
  - Customer-scoped Project/Investment entity (only unrelated `staff` timesheet projects exist)
  - Project dimension in price rows, `PricingContext`, matching and scoring
  - Project reference on quotes/orders passed into line pricing
  - Admin UI for project prices
- **Effort**: 4
- **Suggested implementation path**:
  - App-level `Project` entity (or customers custom entity) linked to quotes via custom field/enricher
  - Project prices as `CatalogProductPrice` rows with `metadata.projectId` or an app-owned entity
  - App resolver via `registerCatalogPricingResolver` reusing `matchesContext`/`selectBestPrice`
  - FLAG: adding `projectId` (or an attributes bag) to `PricingContext` is a contribution to shared `catalog` (ask-first per catalog AGENTS.md)
  - Primitives checked: `business_rules`, `workflows` (do not price lines); planned pricing-engine spec uses the same resolver chain
- **Upstream pipeline**: spec: .ai/specs/2026-08-21-pricing-engine.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 4.3: Dostępność w oddziałach
- **Description**: Jako handlowiec chcę widzieć stan każdej proponowanej pozycji w oddziałach hurtowni, żeby zaproponować realny termin lub zamiennik.
- **Acceptance criteria**:
  - [ ] Stany magazynowe są dostępne per produkt i per oddział (magazyn)
  - [ ] Propozycja oferty pokazuje dostępność każdej pozycji
- **Source**: pdf p.1 (sprawdzić dostępność), pdf p.4 (dostępność w oddziałach)
- **Priority**: P1
- **Dependencies**: 6.4
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/wms/data/entities.ts`: `InventoryBalance` per warehouse, location and catalog variant with on-hand/reserved/allocated and generated `quantity_available`
  - `packages/core/src/modules/wms/api/inventory/balances/route.ts`: balances API filterable by warehouse, returns warehouse name/code per row
  - `packages/core/src/modules/wms/components/backend/WmsSkuDetailPage.tsx`: SKU page with per-warehouse balances
  - `packages/core/src/modules/wms/data/enrichers.ts`: stock enricher only for `sales_order`, not quotes
  - `packages/core/src/modules/wms/widgets/injection-table.ts`: stock column injected only into sales order items; aggregate, not per branch
  - `packages/core/src/modules/inbox_ops/components/proposals/ActionCard.tsx`: no stock lookup in proposals
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/wms/api/inventory/balances/route.ts`
  - C2: gap: no per-line availability on quote lines or inbox_ops proposals; existing order column is aggregate only
- **Grounding query**: `InventoryBalance`
- **Grounding source**: core
- **Gaps**:
  - No quote-line stock enricher or `sales.quote.items` column injection
  - inbox_ops proposal enrichment/UI has no availability
  - No per-warehouse breakdown in the existing order column
  - Shared availability contract only in open PR #6709 (CHANGES_REQUESTED) — not buildable on yet
- **Effort**: 3
- **Suggested implementation path**:
  - Primitives checked: WMS response enrichers, widget injection table, inbox_ops payload enrichment/ai-tools
  - Quote-line stock enricher in `wms/data/enrichers.ts` grouped by warehouse; generalise `order-items-stock-column` for quotes (platform contribution to `wms`/`sales`)
  - Per-line availability lookup in `inbox_ops/lib/payloadEnrichment.ts` rendered in `ActionCard.tsx` (platform contribution to `inbox_ops`)
  - Read `InventoryBalance` directly until PR #6709 (CHANGES_REQUESTED) resolves, then migrate to the contract
- **Upstream pipeline**: PR #6709 (open)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 4.4: Brak ceny lub stanu
- **Description**: Jako handlowiec chcę, żeby pozycja bez ceny lub bez informacji o stanie była oznaczona w propozycji, a nie wyceniona na 0 zł.
- **Acceptance criteria**:
  - [ ] Pozycja bez ceny ma status „brak ceny” i blokuje auto-akceptację
  - [ ] Pozycja bez danych o stanie jest oznaczona jako „stan nieznany”
- **Source**: pdf p.14 (ryzyko 5: uboga kartoteka w małych hurtowniach)
- **Priority**: P1
- **Dependencies**: 4.1, 4.3
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: `InboxDiscrepancyType` has no missing-price or unknown-stock type
  - `packages/core/src/modules/inbox_ops/lib/priceValidator.ts`: skips lines without `unitPrice`, producing no discrepancy
  - `packages/core/src/modules/inbox_ops/lib/payloadEnrichment.ts`: sets `catalogPrice` only when found; no flag otherwise
  - `packages/core/src/modules/inbox_ops/components/proposals/ActionCard.tsx`: missing price rendered as "—"; `hasBlockingDiscrepancies` gate is reusable
  - `packages/core/src/modules/wms/data/entities.ts`: `InventoryBalance.quantityAvailable` exists but inbox_ops never reads it
- **Criteria coverage**:
  - C1: gap: no "missing price" status/discrepancy; no auto-accept path to block
  - C2: gap: no stock lookup in proposals, hence no "unknown stock" marker
- **Grounding query**: `missing_price`
- **Grounding source**: core
- **Gaps**:
  - `missing_price` (error) and `stock_unknown` (warning) discrepancy types
  - Availability enrichment for proposal lines
  - Auto-accept blocking depends on story 5.3 introducing auto-accept
- **Effort**: 3
- **Suggested implementation path**:
  - FLAG: contribution to shared platform module `inbox_ops`
  - Extend `InboxDiscrepancyType` + migration + i18n; emit `missing_price` in `priceValidator.ts`/`payloadEnrichment.ts` using the catalog pricing service; never default to 0
  - Optional WMS availability step (DI-optional like `catalogLookup.ts`), marking lines without a balance row `stock_unknown`
  - Reuse the `hasBlockingDiscrepancies` severity gate for any future auto-accept; primitives checked: `business_rules`, `workflows`
  - Align with PR #6709 (availability contract, CHANGES_REQUESTED)
- **Upstream pipeline**: PR #6709 (open)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 4.5: Zmiana ceny lub stanu między propozycją a akceptacją
- **Description**: Jako handlowiec chcę dostać ostrzeżenie, gdy cena lub stan pozycji zmieniły się od wygenerowania propozycji, zanim oferta pójdzie do klienta.
- **Acceptance criteria**:
  - [ ] Przy akceptacji ceny i stany są przeliczane lub porównywane z bieżącymi
  - [ ] Różnica jest pokazana handlowcowi przed wysłaniem
- **Source**: pdf p.3 (użytkownik pomocniczy: liczba korekt i zwrotów)
- **Priority**: P1
- **Dependencies**: 4.1, 5.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/lib/priceValidator.ts`: `validatePrices` runs once at proposal generation
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: only caller of `validatePrices`
  - `packages/core/src/modules/inbox_ops/lib/executionEngine.ts`: accept path does not re-check prices or stock and auto-resolves discrepancies
  - `packages/core/src/modules/sales/inbox-actions.ts`: copies `unitPrice`/`catalogPrice` snapshot without repricing
  - `packages/core/src/modules/sales/api/quotes/send/route.ts`: no re-check on send
- **Criteria coverage**:
  - C1: gap: prices and stock are not recalculated or compared at acceptance; stock is never checked
  - C2: gap: no old-vs-current difference shown before sending
- **Grounding query**: `priceChangedSinceProposal`
- **Grounding source**: core
- **Gaps**:
  - Accept-time revalidation against the catalog pricing engine
  - Stock check via WMS balances
  - `price_changed`/`stock_changed` discrepancy types + migration
  - Confirmation step with old vs current values (proposal accept and quote send)
- **Effort**: 3
- **Suggested implementation path**:
  - `revalidateProposalAction` helper on `validatePrices` + `catalogPricingService`
  - Stock via WMS inventory services gated by `wms/lib/wmsIntegrationToggles.ts`
  - Preview mode on the accept route and a confirmation step in `ActionCard.tsx`/`EditActionDialog.tsx`, stored as new discrepancies
  - Primitives checked: `business_rules` (thresholds), `notifications`
  - FLAG: contribution to shared `inbox_ops` (and possibly sales quote send)
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

## Epic 5: Oferta z akceptacją handlowca (human-in-the-loop)
**Goal**: System generuje propozycję oferty, handlowiec ją porównuje z zapytaniem, poprawia i akceptuje, a oferta trafia do klienta i może zostać zamieniona w zamówienie.
**Business value**: Adopcja przez handlowców to ryzyko nr 8 (pdf p.14): potrzebny jest interfejs „propozycja do akceptacji”; źródło wskazuje model propozycja → dyspozycja → efektor (pdf p.4).

#### Coverage
- negative-path: Story 5.8
- abuse-case: Story 1.8
- race-condition: Story 5.7
- tenant-isolation: Story 9.1
- data-privacy: Story 9.2
- audit-log: Story 9.3
- data-quality: Story 4.5

### Story 5.1: Propozycja oferty z dopasowanych pozycji
- **Description**: Jako handlowiec chcę dostać gotowy szkic oferty (pozycje, ilości, ceny klienta, dostępność) wygenerowany ze sprawy.
- **Acceptance criteria**:
  - [ ] Ze sprawy powstaje szkic oferty (dokument ofertowy) z liniami z dopasowania
  - [ ] Szkic jest propozycją oczekującą na akceptację, a nie dokumentem wysłanym
- **Source**: pdf p.4 (zapytanie/zestawienie → oferta OF/ZK; agent zwraca propozycję)
- **Priority**: P0
- **Dependencies**: 3.5, 4.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ✅ Implemented (2/2, core)
- **Evidence**:
  - `packages/core/src/modules/sales/inbox-actions.ts`: registers the `create_quote` inbox action (line items with product, variant, sku, quantity, unit price; prompt rules prefer quotes for inquiries); on accept runs `sales.quotes.create`
  - `packages/core/src/modules/inbox_ops/lib/catalogLookup.ts`: catalog products with prices as LLM context
  - `packages/core/src/modules/inbox_ops/lib/priceValidator.ts`: validates line prices against the catalog pricing engine (customer/channel/quantity-specific)
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: proposal/action statuses default `pending` awaiting a human decision
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/actions/[actionId]/accept/route.ts`: nothing is created in sales until the salesperson accepts
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/sales/inbox-actions.ts`
  - C2: covered `packages/core/src/modules/inbox_ops/api/proposals/[id]/actions/[actionId]/accept/route.ts`
- **Grounding query**: `create_quote`
- **Grounding source**: core
- **Gaps**:
  - none for the criteria; outside them: no per-line availability on the draft (stories 4.3/4.4), customer prices only validate extracted prices rather than filling missing ones on the proposal
- **Effort**: 0
- **Suggested implementation path**:
  - Reuse the inbox_ops flow: extraction worker → `InboxProposal` with `create_quote` → review/edit → accept → `sales.quotes.create`
  - Availability on proposals via an app-registered inbox action/payload enrichment (`inbox-actions.ts` extension point)
  - PR #6346 (assisted selling, CHANGES_REQUESTED) is related but not required
- **Upstream pipeline**: PR #6346 (open)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 5.2: Ekran porównania „zapytanie vs propozycja”
- **Description**: Jako handlowiec chcę widzieć obok siebie oryginalną pozycję z zapytania i proponowany produkt, zmieniać wybór kandydata, ilość i zamiennik.
- **Acceptance criteria**:
  - [ ] Widok pokazuje dla każdej linii tekst źródłowy, wybranego kandydata i alternatywy
  - [ ] Handlowiec może zmienić kandydata, ilość lub wybrać zamiennik przed akceptacją
  - [ ] Pozycje o niskiej pewności są wyróżnione
- **Source**: pdf p.4 (ekran porównania „zapytanie vs propozycja” i sugestie zamienników)
- **Priority**: P0
- **Dependencies**: 5.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/3)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/backend/inbox-ops/proposals/[id]/page.tsx`: shows source email next to actions; editing `create_order`/`create_quote` redirects to the sales create page; no per-line comparison
  - `packages/core/src/modules/inbox_ops/components/proposals/ActionCard.tsx`: `OrderPreview` Product/Qty/Price table without source text or alternatives; `ConfidenceBadge` only per action/proposal
  - `packages/core/src/modules/inbox_ops/components/proposals/EditActionDialog.tsx`: no line editor for create_order/create_quote
  - `packages/core/src/modules/inbox_ops/data/validators.ts`: line items lack source text, per-line confidence, candidates, substitute field
  - `packages/core/src/modules/sales/backend/sales/documents/create/page.tsx`: lines only edited after the document exists
- **Criteria coverage**:
  - C1: gap: no per-line side-by-side view of source text, chosen candidate and alternatives
  - C2: gap: no candidate picker, quantity edit or substitute selection before acceptance
  - C3: gap: no per-line confidence, so low-confidence lines cannot be highlighted
- **Grounding query**: `line_substitute`
- **Grounding source**: core
- **Gaps**:
  - Per-line `sourceText`, `matchConfidence`, `candidates[]` in the payload
  - Per-line candidate retrieval (today a flat list of 50 products)
  - Substitute concept in catalog
  - Comparison UI saved via the action PATCH route before accept
- **Effort**: 4
- **Suggested implementation path**:
  - Additive `lineItems` extension (jsonb, no migration) and prompt update
  - Per-line top-N candidates via `@open-mercato/search` resolved with `tryResolve` (primitive checked)
  - Substitute link as an app extension entity (`defineLink`) — FLAG: adding it to `catalog` itself is a platform contribution
  - `CreateOrderPayloadEditor` in `EditActionDialog.tsx` (or component replacement via `widgets/components.ts` for app-only) with DS status tokens for low confidence — FLAG: in-place changes are platform contributions to `inbox_ops`
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 5.3: Polityka auto-akceptacji powyżej progu pewności
- **Description**: Jako kierownik chcę ustawić próg pewności, powyżej którego propozycja (np. zamówienie powtarzalne) jest akceptowana automatycznie.
- **Acceptance criteria**:
  - [ ] Próg auto-akceptacji jest konfigurowalny per tenant (i opcjonalnie per typ sprawy)
  - [ ] Propozycja z każdą pozycją powyżej progu jest akceptowana bez udziału człowieka; pozostałe czekają
- **Source**: pdf p.4 (mutacja przechodzi przez akceptację człowieka lub automatyczną politykę powyżej progu pewności)
- **Priority**: P1
- **Dependencies**: 5.1, 3.5
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, enterprise)
- **Evidence**:
  - `packages/enterprise/src/modules/agent_orchestrator/lib/disposition/autoApprovalPolicy.ts`: `evaluateAutoApproval` auto-approves when the leading option's confidence ≥ `autoApproveThreshold`, after fail-closed gates (tenant switch, guardrails, trace, risk ceiling)
  - `packages/enterprise/src/modules/agent_orchestrator/lib/disposition/tenantAutoApprovalPolicy.ts`: per-tenant policy `{enabled, maxAutoApproveRisk}`
  - `packages/enterprise/src/modules/agent_orchestrator/backend/settings/auto-approval/page.tsx`: admin settings page
  - `packages/enterprise/src/modules/agent_orchestrator/lib/disposition/dispositionService.ts`: auto-approve or park as workflows USER_TASK
  - `packages/core/src/modules/workflows/data/activity-config-schemas.ts`: INVOKE_AGENT `onResult.autoApproveThreshold` per workflow definition
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: inbox_ops threshold is a global env var affecting only email status; no auto-accept
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/workflows/data/activity-config-schemas.ts`
  - C2: gap: auto-approval checks only the whole option's confidence (no every-line rule), and inbox_ops proposals have no auto-accept path
- **Grounding query**: `auto_approval_policy`
- **Grounding source**: core
- **Gaps**:
  - Per-line/per-action gating in `evaluateAutoApproval`
  - inbox_ops not wired to auto-approval; threshold is a global env var
  - No tenant-wide numeric default threshold
  - Auto-approval engine is enterprise-tier (`packages/enterprise`)
- **Effort**: 3
- **Suggested implementation path**:
  - Reuse `DispositionService`/`evaluateAutoApproval` + workflows INVOKE_AGENT and USER_TASK park/resume (primitives checked)
  - Add `requireAllActionsAboveThreshold` / per-action confidence to `evaluateAutoApproval` — FLAG: contribution to enterprise agent_orchestrator and core workflows schema
  - For inbox_ops: `autoAcceptThreshold` in `InboxSettings`, call the existing accept path only when every action qualifies — FLAG: changes platform `inbox_ops`; or route inbox proposals through an INVOKE_AGENT workflow
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 5.4: Wysłanie oferty do klienta w wątku
- **Description**: Jako handlowiec chcę wysłać zaakceptowaną ofertę klientowi jako odpowiedź w tym samym wątku e-mail (PDF oferty w załączniku).
- **Acceptance criteria**:
  - [ ] Oferta jest renderowana do PDF
  - [ ] Odpowiedź wychodzi w wątku zapytania z tej samej skrzynki handlowej
- **Source**: pdf p.3 (nadawca: szybka i kompletna odpowiedź, bez zmiany nawyków)
- **Priority**: P1
- **Dependencies**: 5.2
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/sales/api/quotes/send/route.ts`: sends a standalone email via global `sendEmail` with an accept link; no PDF, no In-Reply-To, no connected mailbox
  - `packages/documents/src/modules/documents/lib/pdfRenderer.ts`: generic Chromium PDF renderer
  - `packages/documents/src/modules/documents/lib/entityRegistry.ts`: quote-bound templates expose only number/status/total/currency, no lines
  - `packages/core/src/modules/communication_channels/commands/deliver-outbound-message.ts`: replies go out through the same connected channel with In-Reply-To/References
  - `packages/core/src/modules/communication_channels/lib/email-capabilities.ts`: `fileSharing: false` for email providers — no outbound attachments
- **Criteria coverage**:
  - C1: gap: no quote → PDF renderer with lines
  - C2: covered `packages/core/src/modules/communication_channels/commands/deliver-outbound-message.ts`
- **Grounding query**: `quotes/send`
- **Grounding source**: core
- **Gaps**:
  - Quote PDF rendering (lines, customer, terms)
  - Outbound attachments in Gmail/IMAP adapters
  - `sales/api/quotes/send` not wired to the communication_channels thread
  - No quote → originating thread link
- **Effort**: 4
- **Suggested implementation path**:
  - Quote PDF service reusing `renderPdfWithChromium` with a lines template — FLAG: platform contribution (sales/documents); coordinate with companion PR #20 "PDF generators" (CHANGES_REQUESTED)
  - Outbound attachment stitching in `packages/channel-gmail`/`packages/channel-imap` and an `attachments` field on `send-as-user` — FLAG: platform contribution
  - "Send quote in thread" action resolving the originating `ChannelThreadMapping` and calling `communicationChannelsSendAsUser`; primitives checked: communication_channels, inbox_ops draft_reply, notifications, workflows
- **Upstream pipeline**: companion PR #20 (open)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 5.5: Konwersja oferty w zamówienie
- **Description**: Jako handlowiec chcę jednym działaniem zamienić przyjętą przez klienta ofertę w zamówienie.
- **Acceptance criteria**:
  - [ ] Oferta w statusie zaakceptowanej może zostać przekonwertowana na zamówienie z tymi samymi liniami
  - [ ] Zamówienie zachowuje powiązanie z ofertą i sprawą
- **Source**: pdf p.4 (oferta w ERP, potem konwersja w zamówienie)
- **Priority**: P1
- **Dependencies**: 5.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/sales/commands/documents.ts`: `sales.quotes.convert_to_order` copies header, lines, adjustments, custom fields, addresses, notes and tags into a new order, then deletes the quote; order reuses the quote UUID by default
  - `packages/core/src/modules/sales/api/quotes/convert/route.ts`: manual one-action conversion endpoint
  - `packages/core/src/modules/sales/api/quotes/accept/route.ts`: accept flow (sent → confirmed) converting in the same transaction
  - `packages/core/src/modules/sales/backend/sales/documents/[id]/page.tsx`: "Convert to order" action
  - `packages/core/src/modules/sales/data/entities.ts`: `SalesQuote.convertedOrderId` exists but is never written; no source-quote or case reference on orders
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/sales/api/quotes/convert/route.ts`
  - C2: gap: no persisted quote → order link (quote deleted, `convertedOrderId` unset) and no order → case reference
- **Grounding query**: `convert_to_order`
- **Grounding source**: core
- **Gaps**:
  - Destructive conversion; lineage only via shared UUID (overridable)
  - `convertedOrderId` never populated; no `sourceQuoteId`
  - No typed case link on quote/order
  - Manual convert endpoint does not enforce accepted status
- **Effort**: 3
- **Suggested implementation path**:
  - FLAG: lineage fix is a contribution to shared `sales` (keep quote with status `converted`, write `convertedOrderId`, add `sourceQuoteId`), or an app-level command interceptor/response enricher
  - Accepted-status guard via mutation guard or `business_rules` (primitives already wired into the route)
  - Case link as a typed extension/custom field — conversion already copies custom fields and metadata
  - Watch PR #6297 (CHANGES_REQUESTED) on the accept-and-convert route
- **Upstream pipeline**: PR #6297 (open)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 5.6: Zamówienie powtarzalne jako podprzypadek tego samego potoku
- **Description**: Jako handlowiec chcę, żeby zamówienie od stałego klienta przechodziło tym samym potokiem, ale kończyło się propozycją zamówienia zamiast oferty.
- **Acceptance criteria**:
  - [ ] Sprawa sklasyfikowana jako zamówienie tworzy propozycję zamówienia z tych samych dopasowanych linii
- **Source**: pdf p.12 (zamówienia od stałych klientów są podprzypadkiem tego samego potoku, bo zamówienie to oferta bez negocjacji)
- **Priority**: P1
- **Dependencies**: 1.3, 5.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ✅ Implemented (1/1, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: `InboxProposalCategory` includes `order` and `rfq`; `InboxActionType` includes `create_order` and `create_quote`
  - `packages/core/src/modules/inbox_ops/lib/extractionPrompt.ts`: one extraction pass classifies and proposes actions
  - `packages/core/src/modules/sales/inbox-actions.ts`: `create_order` and `create_quote` share `orderPayloadSchema` and `executeCreateDocumentAction`
  - `packages/core/src/modules/inbox_ops/subscribers/extractionWorker.ts`: same price validation, enrichment and unmatched-product handling for both
  - `packages/core/src/modules/inbox_ops/lib/executionHelpers.ts`: `resolveEffectiveDocumentKind` switches order → quote when the channel requires quotes
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/sales/inbox-actions.ts`
- **Grounding query**: `create_order`
- **Grounding source**: core
- **Gaps**:
  - none blocking; order vs quote choice is LLM prompt-driven ("when in doubt, prefer create_quote"), with no deterministic rule for known repeat customers
- **Effort**: 1
- **Suggested implementation path**:
  - Reuse the pipeline as is
  - For deterministic repeat-order handling add app prompt rules via the `inboxActions` extension (`promptRules`) or a post-extraction rule held in `business_rules`
  - Primitives checked: proposal accept/reject flow, `proposalNotifier`, `executionAuditor`, `business_rules`
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 5.7: Współbieżna edycja propozycji
- **Description**: Jako handlowiec chcę, żeby jednoczesna edycja lub akceptacja tej samej propozycji przez dwie osoby nie nadpisała cudzych zmian ani nie wysłała oferty dwa razy.
- **Acceptance criteria**:
  - [ ] Zapis propozycji jest chroniony blokadą optymistyczną (konflikt wersji zwraca błąd)
  - [ ] Akceptacja jest jednokrotna: druga akceptacja tej samej propozycji jest odrzucana
- **Source**: pdf p.3 (5–30 handlowców wewnętrznych i zewnętrznych w firmie docelowej)
- **Priority**: P1
- **Dependencies**: 5.2
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ✅ Implemented (2/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/actions/[actionId]/route.ts`: PATCH edit calls `enforceCommandOptimisticLockWithGuards` against `action.updatedAt`, returns 409 on stale write
  - `packages/shared/src/lib/crud/optimistic-lock-command.ts`: shared optimistic-lock guard (OSS + optional enterprise guard)
  - `packages/core/src/modules/inbox_ops/components/proposals/EditActionDialog.tsx`: sends `buildOptimisticLockHeader(action.updatedAt)`, handles `extractOptimisticLockConflict`
  - `packages/core/src/modules/inbox_ops/lib/executionEngine.ts`: accept claims the action atomically (`nativeUpdate` pending/failed → processing); 0 rows → 409 "Action already processed"
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/replies/[replyId]/send/route.ts`: atomic `replySendClaimedAt` claim prevents double send
  - `packages/core/src/modules/inbox_ops/lib/__tests__/executionEngine.test.ts`: tests 409 on already-processed action
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/inbox_ops/api/proposals/[id]/actions/[actionId]/route.ts`
  - C2: covered `packages/core/src/modules/inbox_ops/lib/executionEngine.ts`
- **Grounding query**: `optimistic-lock-command`
- **Grounding source**: core
- **Gaps**:
  - none (minor: version check is opt-in per request header; no separate version check on the `InboxProposal` row itself)
- **Effort**: 0
- **Suggested implementation path**:
  - Reuse the existing proposal/action flow; any app-owned editing screens must send `buildOptimisticLockHeader(updatedAt)` and handle conflicts like `EditActionDialog.tsx`
  - Optional: enterprise `record_locks` for pessimistic locking (app-side configuration)
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 5.8: Odrzucenie propozycji z powodem
- **Description**: Jako handlowiec chcę odrzucić propozycję (w całości lub pozycję) z podaniem powodu, żeby system nie wykonał akcji i żeby było to widoczne w metrykach.
- **Acceptance criteria**:
  - [ ] Odrzucenie propozycji nie wywołuje żadnej mutacji w ofertach ani ERP
  - [ ] Powód odrzucenia jest zapisany przy propozycji
- **Source**: pdf p.14 (ryzyko 8: handlowcy mogą nie ufać dopasowaniom; potrzebne metryki)
- **Priority**: P1
- **Dependencies**: 5.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/lib/executionEngine.ts`: `rejectAction`/`rejectProposal` only set status `rejected`, resolve discrepancies and emit events — no sales or ERP mutation; no reason parameter
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/reject/route.ts`: whole-proposal reject, no body/reason
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/actions/[actionId]/reject/route.ts`: per-action reject, no reason
  - `packages/core/src/modules/inbox_ops/backend/inbox-ops/proposals/[id]/page.tsx`: reject buttons open a plain confirm dialog
  - `packages/core/src/modules/inbox_ops/api/proposals/counts/route.ts`: counts rejected proposals without reason breakdown
  - `packages/enterprise/src/modules/agent_orchestrator/data/entities.ts`: `AgentProposal.dispositionReason` pattern exists for agent proposals only
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/inbox_ops/lib/executionEngine.ts`
  - C2: gap: no rejection-reason field on proposals/actions; routes, engine and UI neither accept nor store a reason
- **Grounding query**: `rejectProposal`
- **Grounding source**: core
- **Gaps**:
  - Storage for rejection reason (proposal and action)
  - Reason input in reject routes and dialogs; reason in rejected events
  - Metrics by rejection reason
- **Effort**: 3
- **Suggested implementation path**:
  - FLAG: contribution to core `inbox_ops` (app stopgap: store the reason in `metadata`)
  - Add `rejection_reason`/`rejection_reason_code` + migration; optional `reason` in `rejectAction`/`rejectProposal`; zod body in reject routes
  - Reason dialog with a dictionary-backed list (pattern: `warranty_claims/lib/dictionaries.ts`)
  - Aggregate by reason reusing the rollup approach in `agent_orchestrator/lib/metrics/metricRollupService.ts` (primitive checked)
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

## Epic 6: Integracja z ERP MŚP
**Goal**: Zaakceptowana oferta lub zamówienie powstaje jako dokument OF/ZK w ERP hurtowni, a katalog, cenniki i stany są synchronizowane z ERP.
**Business value**: Konektory do Subiekta, Optimy i enova to główna przewaga nad Mercurą i Conexiom (pdf p.1, p.7); klient docelowy nie ma własnego IT (pdf p.3).

#### Coverage
- negative-path: Story 6.5
- abuse-case: Story 6.6
- race-condition: Story 6.5
- tenant-isolation: Story 9.1
- data-privacy: Story 6.6
- audit-log: Story 9.3
- data-quality: Story 6.4

### Story 6.1: Konektor Subiekt GT/nexo (Sfera) — dokument OF/ZK
- **Description**: Jako hurtownia na Subiekcie chcę, żeby zaakceptowana oferta lub zamówienie powstały w Subiekcie jako dokument OF lub ZK.
- **Acceptance criteria**:
  - [ ] Konektor tworzy w Subiekcie GT/nexo dokument oferty (OF) lub zamówienia (ZK) z liniami, kontrahentem i cenami
  - [ ] Numer dokumentu z ERP jest zapisany przy ofercie w platformie
- **Source**: pdf p.1 (konektory do Subiekta, Optimy i enova), pdf p.8 (InsERT: konektor Sfera jako dodatek)
- **Priority**: P0
- **Dependencies**: 5.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/data_sync/lib/adapter.ts`: generic `DataSyncAdapter` export contract (`ExportItemResult { localId, externalId }`); no Subiekt/InsERT adapter registered
  - `packages/core/src/modules/data_sync/lib/sync-engine.ts`: generic export engine
  - `packages/core/src/modules/integrations/data/entities.ts`: `SyncExternalIdMapping` could hold the ERP document id; nothing writes one
  - `packages/core/src/modules/sales/data/entities.ts`: `SalesQuote.externalReference`/`SalesOrder.externalReference` storage slots, unfilled by any connector
  - `packages/sync-akeneo/src/modules/sync_akeneo/integration.ts`: reference connector pattern (PIM only)
- **Criteria coverage**:
  - C1: gap: no InsERT Sfera (Subiekt GT/nexo) connector building OF/ZK documents with lines, customer and prices
  - C2: gap: no connector writes the ERP document number back to the quote
- **Grounding query**: `sync-subiekt`
- **Grounding source**: core
- **Gaps**:
  - Connector package (integration registration, credentials schema)
  - On-premise Sfera bridge (Windows .NET/COM service) — external dependency
  - Quote/order → OF/ZK mapping with kontrahent and towar id matching
  - No `sales.quote.accepted` event; no ERP number write-back
- **Effort**: 5
- **Suggested implementation path**:
  - Connector package modelled on `packages/sync-akeneo` implementing a `DataSyncAdapter` export stream via `data_sync/lib/adapter-registry.ts`, credentials via `integrations`
  - Sfera bridge exposing HTTP for OF/ZK creation, called through data_sync queue/progress
  - Trigger on quote update to accepted / `sales.order.created`, or a `workflows`/`business_rules` action enqueueing an export (primitives checked: workflows, business_rules, data_sync, integrations, progress, queue)
  - Write-back to `externalReference` + `SyncExternalIdMapping`; widget injection on quote detail
  - FLAG: a first-class `sales.quote.accepted` event is a platform contribution; related PR #6681 (APPROVED) and PR #6318 (CHANGES_REQUESTED) harden the engine
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 6.2: Konektor Comarch Optima/XL
- **Description**: Jako hurtownia na Comarch Optima lub XL chcę, żeby zaakceptowana oferta lub zamówienie powstały w ERP jako dokument.
- **Acceptance criteria**:
  - [ ] Konektor tworzy w Comarch Optima (lub XL) dokument oferty lub zamówienia z liniami i kontrahentem
- **Source**: pdf p.3 (ERP klasy MŚP: Comarch Optima/XL), pdf p.8
- **Priority**: P1
- **Dependencies**: 5.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/1)
- **Evidence**:
  - `packages/core/src/modules/data_sync/lib/adapter.ts`: generic `DataSyncAdapter` (export via `streamExport`) — extension seam, not a Comarch implementation
  - `packages/core/src/modules/integrations/`: registry, credentials and encryption for provider packages
  - `packages/sync-akeneo/src/modules/sync_akeneo/`: reference provider package (PIM import only)
  - `packages/core/src/modules/sales/events.ts`: `sales.order.created` could trigger an outbound push
- **Criteria coverage**:
  - C1: gap: no Comarch Optima/XL connector in core or companion; nothing creates a quote/order document with lines and customer account in the ERP
- **Grounding query**: `comarchOptima`
- **Grounding source**: core
- **Gaps**:
  - Comarch Optima/XL provider package (registration, credentials, API client or on-premise bridge)
  - Mapping sales quote/order + lines to a Comarch document and customer to kontrahent with id mapping
  - Outbound trigger on acceptance/creation and status write-back
- **Effort**: 5
- **Suggested implementation path**:
  - Primitives checked: `data_sync` (adapter, `streamExport`, `id-mapping.ts`, queue/progress), `integrations`, event subscribers, `progress`
  - Provider package modelled on `packages/sync-akeneo` (e.g. `sync-comarch`) with `DataSyncAdapter` export for `sales_order`/`sales_quote`
  - Subscriber on `sales.order.created`/quote acceptance enqueuing a single-record export; write back ERP document number
  - External dependency: Comarch API access (Optima on-premise bridge, XL separate adapter); best shipped in the companion repo; related PR #6318 (CHANGES_REQUESTED) and PR #6681 (APPROVED) touch the engine
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 6.3: Konektor enova365
- **Description**: Jako hurtownia na enova365 chcę, żeby zaakceptowana oferta lub zamówienie powstały w ERP jako dokument.
- **Acceptance criteria**:
  - [ ] Konektor tworzy w enova365 dokument oferty lub zamówienia z liniami i kontrahentem
- **Source**: pdf p.1, pdf p.3 (ERP klasy MŚP: enova365)
- **Priority**: P1
- **Dependencies**: 5.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/1)
- **Evidence**:
  - `packages/core/src/modules/data_sync/lib/adapter.ts`: generic `DataSyncAdapter` with optional `streamExport` — extension seam, not an enova365 connector
  - `packages/core/src/modules/data_sync/workers/sync-export.ts`: export worker; no enova365 adapter registered
  - `packages/sync-akeneo/src/modules/sync_akeneo/integration.ts`: only shipped sync provider (PIM, not ERP) — reference pattern
  - `packages/core/src/modules/sales/events.ts`: `sales.order.created` with no ERP push subscriber
- **Criteria coverage**:
  - C1: gap: no enova365 connector in either checkout — no adapter, API client or mapping creating an enova365 quote/order document with lines and kontrahent
- **Grounding query**: `enovaConnector`
- **Grounding source**: core
- **Gaps**:
  - enova365 API client and credentials schema as an integration provider
  - Export adapter mapping sales quotes/orders (header, lines, kontrahent) to enova365 trade documents
  - ID mapping for kontrahent/product/document and ERP document-number write-back
  - Trigger on order creation / quote acceptance; enova365 API access is an unevaluated external dependency
- **Effort**: 5
- **Suggested implementation path**:
  - Provider package modelled on `packages/sync-akeneo` registering `enova365` with `integrations`; in the companion repo it is a shared-module contribution
  - `DataSyncAdapter` (`direction: 'export'`, `sales_order`/`sales_quote`) with `streamExport`, reusing `data_sync/lib/id-mapping.ts`
  - Subscriber or workflow trigger on `sales.order.created`/quote acceptance enqueueing via `data_sync/lib/queue.ts` (primitives checked: data_sync queue/progress, workflows)
  - NIP-based kontrahent dedupe; document number stored in a custom field; secure enova365 API/sandbox access first
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 6.4: Synchronizacja katalogu, cenników i stanów z ERP
- **Description**: Jako hurtownia chcę, żeby kartoteka towarów, cenniki, rabaty kontrahentów i stany magazynowe były cyklicznie synchronizowane z ERP do platformy.
- **Acceptance criteria**:
  - [ ] Import z ERP obejmuje towary, ceny, rabaty kontrahentów i stany per magazyn
  - [ ] Synchronizacja jest przyrostowa i uruchamiana cyklicznie w tle
- **Source**: pdf p.4 (dane: katalog z ERP), pdf p.8 (integracja z ERP/PIM)
- **Priority**: P0
- **Dependencies**: none
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/data_sync/lib/sync-engine.ts`: streaming import/export engine with per-batch cursor persistence, item error logs, progress
  - `packages/core/src/modules/data_sync/lib/start-cursor.ts`: incremental start cursor resolution
  - `packages/core/src/modules/data_sync/lib/sync-schedule-service.ts`: cron/interval schedules per integration and entity
  - `packages/core/src/modules/data_sync/workers/sync-scheduled.ts`: scheduled dispatch into background runs
  - `packages/core/src/modules/data_sync/lib/adapter.ts`: `DataSyncAdapter` contract
  - `packages/sync-akeneo/src/modules/sync_akeneo/lib/adapter.ts`: only catalog adapter (PIM: categories, attributes, products)
  - `packages/core/src/modules/catalog/data/entities.ts` / `packages/core/src/modules/wms/data/entities.ts`: storage targets for customer prices and per-warehouse stock
- **Criteria coverage**:
  - C1: gap: no ERP adapter in either repo; nothing imports customer-specific discounts or per-warehouse stock
  - C2: covered `packages/core/src/modules/data_sync/workers/sync-scheduled.ts`
- **Grounding query**: `streaming data synchronization`
- **Grounding source**: core
- **Gaps**:
  - No ERP connector package (only `sync_akeneo` and `sync_excel` register adapters)
  - No adapter entities for customer prices/discounts or stock levels
  - PR #6318 (retry/resume, CHANGES_REQUESTED) and PR #6681 (progress job, APPROVED) change the adapter/run lifecycle
- **Effort**: 5
- **Suggested implementation path**:
  - Provider module/package modelled on `packages/sync-akeneo` implementing `DataSyncAdapter` (`direction: 'import'`), registered via `registerDataSyncAdapter`
  - Map products/prices like `sync_akeneo/lib/catalog-importer.ts`; customer discounts to `CatalogProductPrice` with `customerId` via `externalIdMappingService`; stock to `wms_inventory_balances`
  - Cursor-based incremental runs; reuse `SyncSchedule`, `IntegrationScheduleTab`, `sync-scheduled`/`sync-import` (primitives checked: data_sync, integrations, scheduler, queue, progress)
  - External dependency on the specific ERP API; rebase on PR #6318 (CHANGES_REQUESTED) and PR #6681 (APPROVED); a reusable companion connector is a shared-module contribution
- **Upstream pipeline**: PR #6318 (open)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 6.5: Błąd zapisu w ERP i ponowienia
- **Description**: Jako handlowiec chcę widzieć, że dokument nie powstał w ERP, i mieć bezpieczne ponowienie, które nie tworzy duplikatu dokumentu.
- **Acceptance criteria**:
  - [ ] Nieudany zapis do ERP ma status błędu z przyczyną i jest ponawiany z limitem prób
  - [ ] Ponowienie jest idempotentne: nie powstaje drugi dokument OF/ZK dla tej samej oferty
- **Source**: pdf p.3 (użytkownik pomocniczy: liczba korekt i zwrotów)
- **Priority**: P1
- **Dependencies**: 6.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/data_sync/lib/sync-engine.ts`: logs per-item export failures, marks runs `failed` with `lastError`, raises `SyncRunPartialFailureError`
  - `packages/core/src/modules/data_sync/lib/queue-policy.ts`: `DATA_SYNC_QUEUE_ATTEMPTS = 3` bounded job retry
  - `packages/core/src/modules/data_sync/api/runs/[id]/retry.ts`: operator retry of failed runs with overlap and mutation guards
  - `packages/core/src/modules/integrations/data/entities.ts`: `SyncExternalIdMapping` with `syncStatus` incl. `error`; no error-reason column, no unique constraint per local entity
  - `packages/core/src/modules/data_sync/lib/id-mapping.ts`: `lookupExternalId`/`storeExternalIdMapping` usable for pre-create checks
  - `packages/core/src/modules/integrations/widgets/injection/external-ids/widget.client.tsx`: shows `error` badge without reason
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/data_sync/lib/sync-engine.ts`
  - C2: gap: no ERP adapter writing OF/ZK documents, no pre-create external-id check and no uniqueness guaranteeing one ERP document per quote
- **Grounding query**: `retrySyncSchema`
- **Grounding source**: core
- **Gaps**:
  - No ERP export adapter in either checkout
  - No idempotency key per quote; non-unique mapping indexes
  - No per-item automatic retry (only whole-job attempts)
  - Failure reason not visible on the quote
  - PR #6318 (CHANGES_REQUESTED) may change retry semantics
- **Effort**: 3
- **Suggested implementation path**:
  - ERP connector (story 6.1) as `DataSyncAdapter` with `direction: 'export'`, reusing run status, `lastError`, queue policy and retry endpoint (primitives checked: data_sync, integrations, queue/progress, notifications)
  - In `streamExport`, `lookupExternalId` before create plus an ERP-side external reference (quote number) for reconciliation; store mapping right after create
  - Unique partial index and `last_error` on `sync_external_id_mappings`, shown in the widget — FLAG: platform contribution to `integrations`
  - App-side outbound queue with per-document attempts (pattern: `example_customers_sync/workers/outbound.ts`) and a `notifications` notice on final failure
- **Upstream pipeline**: PR #6318 (open)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 6.6: Bezpieczne przechowywanie poświadczeń ERP
- **Description**: Jako hurtownia chcę, żeby poświadczenia do ERP i skrzynki pocztowej były przechowywane szyfrowane i dostępne tylko dla konektora mojego tenanta.
- **Acceptance criteria**:
  - [ ] Poświadczenia integracji są szyfrowane w spoczynku
  - [ ] Poświadczenia nie są zwracane w odpowiedziach API ani logach
- **Source**: pdf p.3 (klient bez własnego IT: platforma przechowuje dostęp do ERP w jego imieniu)
- **Priority**: P1
- **Dependencies**: none
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ✅ Implemented (2/2, core)
- **Evidence**:
  - `packages/core/src/modules/integrations/encryption.ts`: encryption map for `integration_credentials.credentials` (at rest)
  - `packages/core/src/modules/integrations/lib/credentials-service.ts`: AES-GCM with tenant DEK from KMS/Vault, tenant/org/user scoped, fails closed without a DEK
  - `packages/core/src/modules/integrations/lib/__tests__/credentials-service.test.ts`: tests DEK-only encryption and fail-closed reads
  - `packages/core/src/modules/integrations/lib/credentials-masking.ts`: secret/oauth/ssh fields masked on read, merged back on save (write-only through API)
  - `packages/core/src/modules/integrations/api/[id]/credentials/route.ts`: GET/PUT gated by `integrations.credentials.manage`; events carry ids only
  - `packages/shared/src/lib/logger/transport.server.ts`: pino logger redacts password/token/secret/authorization
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/integrations/lib/credentials-service.ts`
  - C2: covered `packages/core/src/modules/integrations/lib/credentials-masking.ts`
- **Grounding query**: `credentials-masking`
- **Grounding source**: core
- **Gaps**:
  - none for the criteria; hardening: `IntegrationLogService.write` (`integrations/lib/log-service.ts`) stores provider payloads unscrubbed; console logger transport has no redaction; connectors must declare secret fields as `secret`/`oauth`
- **Effort**: 1
- **Suggested implementation path**:
  - Declare ERP connector credential fields with type `secret`/`oauth`; access only via `integrationCredentialsService`
  - Configure Vault or `TENANT_DATA_ENCRYPTION_FALLBACK_KEY` in production
  - Optional hardening (FLAG: platform contribution): scrub secret keys in `createIntegrationLogService.write` and the console transport; PR #6767 (key rotation) is adjacent
- **Upstream pipeline**: PR #6767 (open)
- **Investigated**: 2026-09-30 (gate PASS)

## Epic 7: Dane katalogowe ETIM i BMEcat
**Goal**: Uboga kartoteka z ERP jest wzbogacana o klasy i cechy ETIM z repozytoriów branżowych, co podnosi trafność dopasowania.
**Business value**: Dane ETIM z Repozytorium ZHI to przewaga konkurencyjna (pdf p.1); jakość danych katalogowych to ryzyko nr 5, które zamienia wdrożenie w projekt danych (pdf p.14).

#### Coverage
- negative-path: Story 7.3
- abuse-case: out-of-scope: import z zaufanych repozytoriów branżowych uruchamiany przez administratora tenanta; brak wejścia od klienta końcowego
- race-condition: out-of-scope: import katalogu działa jako pojedyncze zadanie w tle per tenant; współbieżność importów nie jest wymagana
- tenant-isolation: Story 9.1
- data-privacy: out-of-scope: dane produktowe ETIM/BMEcat nie zawierają danych osobowych
- audit-log: out-of-scope: import danych referencyjnych nie wymaga audytu na poziomie rekordu; wystarcza historia zadań importu
- data-quality: Story 7.4

### Story 7.1: Import BMEcat/ETIM z repozytoriów branżowych
- **Description**: Jako hurtownia chcę zaimportować dane BMEcat/ETIM z Repozytorium ZHI (HEPAC), ETIM Polska (elektro) lub MEGACENNIK (EL-Plus).
- **Acceptance criteria**:
  - [ ] Plik BMEcat (XML) z klasami i cechami ETIM jest importowany do katalogu
  - [ ] Import zapisuje klasę ETIM i wartości cech przy produkcie
- **Source**: pdf p.4 (katalog z ERP wzbogacony o ETIM/BMEcat: Repozytorium ZHI, ETIM Polska, MEGACENNIK)
- **Priority**: P1
- **Dependencies**: none
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/catalog/data/entities.ts`: no ETIM class/feature entity or BMEcat field
  - `packages/core/src/modules/sync_excel/lib/adapters/customers.ts`: only file-import adapter (customers)
  - `packages/sync-akeneo/src/modules/sync_akeneo/lib/catalog-importer.ts`: closest pattern — maps PIM families/attributes to typed custom fields (REST, not BMEcat)
  - `packages/core/src/modules/data_sync`: engine where a BMEcat adapter would plug in
- **Criteria coverage**:
  - C1: gap: no BMEcat XML parser or catalog import adapter
  - C2: gap: no storage/mapping of ETIM class (EC) or feature values (EF/EV/EU) on products
- **Grounding query**: `bmecat`
- **Grounding source**: core
- **Gaps**:
  - BMEcat 2005 / ETIM XML streaming parser
  - data_sync adapter upserting products by supplier PID/EAN
  - ETIM class model (category tree or class-code field + ETIM version)
  - ETIM feature custom-field definitions and values; source presets (ZHI, ETIM Polska, MEGACENNIK) and upload UI
- **Effort**: 4
- **Suggested implementation path**:
  - Integration module `sync_bmecat` modelled on `packages/sync-akeneo` (integration, adapter, importer, mapping, workers) on data_sync with progress/queue
  - SAX-style XML parser emitting batches; map ETIM class to category or custom field and features to custom-field definitions like `mapAkeneoAttributeInputType`
  - Primitives checked: data_sync, integrations, sync_excel (not reusable), progress/queue, catalog custom fields/categories
  - FLAG: first-class ETIM fields in core catalog would be a platform contribution; app/companion module otherwise
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 7.2: Katalog wielomarkowy z producentem i kodem producenta
- **Description**: Jako hurtownia chcę, żeby każdy produkt miał producenta (markę), kod producenta i EAN, żeby dało się łączyć dane z różnych źródeł i szukać zamienników.
- **Acceptance criteria**:
  - [ ] Produkt ma pola producent/marka, kod producenta i EAN
  - [ ] Katalog można filtrować i wyszukiwać po producencie i kodzie producenta
- **Source**: pdf p.4 (zamienniki między markami), pdf p.9 (grupy zakupowe: centralne dane ETIM, BMEcat, cenniki)
- **Priority**: P1
- **Dependencies**: none
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/catalog/data/entities.ts`: `CatalogProduct` has `sku`/`handle` but no manufacturer, brand or manufacturer-code column; EAN only as variant `barcode` + `gtinType`
  - `packages/core/src/modules/catalog/lib/gtin.ts`: EAN/UPC checksum helper (variant level)
  - `packages/core/src/modules/catalog/search.ts`: variant search indexes name/sku/barcode; custom fields appended to indexed text
  - `packages/core/src/modules/catalog/api/products/route.ts`: free-text search on title/sku; `cf_*` custom-field filters available
  - `packages/core/src/modules/catalog/ce.ts`: catalog custom entity specs ship with no predefined brand/manufacturer fields
- **Criteria coverage**:
  - C1: gap: no first-class manufacturer/brand or manufacturer-code field; EAN exists only per variant
  - C2: gap: no filter or search by manufacturer or manufacturer code (fields do not exist; generic `cf_*` filters could serve once defined)
- **Grounding query**: `manufacturerCode`
- **Grounding source**: core
- **Gaps**:
  - Manufacturer/brand field (dictionary-backed for normalisation)
  - Manufacturer code (MPN) field
  - Product-level EAN view for simple products
  - Free-text search/filters on manufacturer and manufacturer code
- **Effort**: 2
- **Suggested implementation path**:
  - App `ce.ts` custom fields `manufacturer` (dictionary/select) and `manufacturer_code` on `catalog.catalog_product` with `filterable`/`indexed`/`listVisible` — existing `cf_*` filters and `appendCustomFieldLines` then provide filtering and search
  - Reuse variant `barcode` + `gtinType` as EAN
  - FLAG: first-class catalog columns would be a platform contribution to `catalog` (effort 3); primitives checked: entities custom fields, search indexing, data_sync/integrations
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 7.3: Wzbogacanie kartoteki ERP danymi ETIM
- **Description**: Jako hurtownia chcę, żeby produkty zsynchronizowane z ERP (skrócone nazwy, brak atrybutów) zostały połączone z rekordami ETIM po EAN lub kodzie producenta, a niepołączone były raportowane.
- **Acceptance criteria**:
  - [ ] Produkty z ERP są łączone z rekordami ETIM po EAN lub kodzie producenta
  - [ ] Produkty, których nie udało się połączyć, trafiają na listę do ręcznego uzupełnienia
- **Source**: pdf p.14 (ryzyko 5: w małych hurtowniach kartoteka bywa uboga: skrócone nazwy, brak atrybutów)
- **Priority**: P1
- **Dependencies**: 6.4, 7.1, 7.2
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/catalog/data/entities.ts`: variant `barcode` + `gtinType` (EAN key); no manufacturer code field and no ETIM storage
  - `packages/core/src/modules/catalog/lib/gtin.ts`: GTIN checksum validation only
  - `packages/core/src/modules/data_sync/lib/id-mapping.ts`: `ExternalIdMappingService` links local records to external ids; no EAN matching
  - `packages/sync-akeneo/src/modules/sync_akeneo/lib/catalog-importer.ts`: matches only by external id; no unmatched report
- **Criteria coverage**:
  - C1: gap: no ETIM record source and no service linking ERP-synced products to ETIM records by EAN or manufacturer code
  - C2: gap: no list of unmatched products for manual completion
- **Grounding query**: `etim_enrichment`
- **Grounding source**: core
- **Gaps**:
  - ETIM reference data model and import adapter
  - Manufacturer code (MPN) field as fallback key
  - Matching engine EAN → manufacturer code
  - Unmatched / manual-completion list with per-product status
- **Effort**: 4
- **Suggested implementation path**:
  - Primitives checked: data_sync adapter + `ExternalIdMappingService`, integrations, progress/queue, sync_excel, catalog custom fields, sync_akeneo
  - App/companion `etim_enrichment` module with an `EtimRecord` entity fed by a data_sync adapter
  - MPN as catalog custom field — FLAG: first-class `manufacturerPartNumber` in `catalog` is a platform contribution
  - Queue worker matching barcode → EAN with MPN fallback, persisting links via `ExternalIdMappingService`; `EtimMatchIssue` entity with a DataTable page and optional `notifications` alert
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 7.4: Raport jakości danych katalogowych
- **Description**: Jako wdrożeniowiec chcę raport kompletności kartoteki (odsetek produktów z ETIM, EAN, producentem, przelicznikami), żeby wycenić wdrożenie i pokazać klientowi, co poprawić.
- **Acceptance criteria**:
  - [ ] Raport pokazuje N/M produktów z klasą ETIM, EAN, producentem i przelicznikami jednostek
- **Source**: pdf p.14 (ryzyko 5: wdrożenie staje się projektem danych; trzeba to wycenić w opłacie wdrożeniowej)
- **Priority**: P2
- **Dependencies**: 7.3
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/1)
- **Evidence**:
  - `packages/core/src/modules/catalog/data/entities.ts`: variants carry `barcode`/`gtinType`; products have unit conversions; no ETIM class or manufacturer field
  - `packages/core/src/modules/catalog/ai-tools/stats-pack.ts`: `catalog.show_stats` returns only totals (products, active, categories, tags)
  - `packages/core/src/modules/catalog/analytics.ts`: analytics expose id/name/status/createdAt only
  - `packages/core/src/modules/eudr/lib/completeness.ts`: reusable completeness-calculation pattern (other domain)
- **Criteria coverage**:
  - C1: gap: no report or widget showing N/M products with ETIM class, EAN, manufacturer and unit conversions; ETIM and manufacturer fields do not exist
- **Grounding query**: `catalogCompleteness`
- **Grounding source**: core
- **Gaps**:
  - Catalog completeness report (API, page or widget)
  - ETIM class and manufacturer fields (depend on stories 7.1–7.3 / custom fields)
  - Rule for product-level EAN (variant barcode)
- **Effort**: 3
- **Suggested implementation path**:
  - Org-scoped aggregate route in the app module modelled on `eudr/lib/completeness.ts` counting products with ETIM class, manufacturer, ≥1 barcode variant, ≥1 unit conversion
  - Dashboard widget following `eudr/widgets/dashboard/compliance-overview`; guard with `catalog.products.view`
  - Optional read-only AI tool next to `catalog.show_stats`
  - Primitives checked: analytics, dashboards widgets, ai-assistant tools; FLAG: extending the upstream product-quality widget spec would be a platform contribution
- **Upstream pipeline**: spec: .ai/specs/SPEC-008-2026-01-27-product-quality-widget.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

## Epic 8: Metryki wartości i adopcji
**Goal**: Hurtownia widzi mierzalny efekt: czas do oferty, konwersję ofert, liczbę ofert na handlowca i trafność dopasowań.
**Business value**: Cena 3–5 tys. zł/mies. jest do obrony tylko przy mierzalnym wzroście liczby wygranych ofert (pdf p.1); brak twardych danych o bólu to ryzyko nr 6 (pdf p.14).

#### Coverage
- negative-path: out-of-scope: metryki są odczytem zdarzeń z Epic 1–5; brak danych daje pusty wykres, a nie błędną akcję
- abuse-case: out-of-scope: metryki są tylko do odczytu w obrębie tenanta; dostęp kontroluje Story 9.5
- race-condition: out-of-scope: metryki są agregatami po fakcie, bez zapisu współbieżnego
- tenant-isolation: Story 9.1
- data-privacy: Story 8.3
- audit-log: out-of-scope: metryki same wynikają ze śladu zdarzeń audytowanych w Story 9.3
- data-quality: Story 8.3

### Story 8.1: Czas od zapytania do oferty
- **Description**: Jako właściciel hurtowni chcę widzieć czas od wpłynięcia zapytania do wysłania oferty, per sprawa, handlowiec i okres.
- **Acceptance criteria**:
  - [ ] Znaczniki czasu wpłynięcia, akceptacji i wysłania są zapisywane dla każdej sprawy
  - [ ] Dashboard pokazuje medianę czasu do oferty per handlowiec i okres
- **Source**: pdf p.3 (użytkownik główny mierzy czas od zapytania do oferty), pdf p.4 (metryki)
- **Priority**: P1
- **Dependencies**: 5.4
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: `InboxEmail.receivedAt`, `InboxProposalAction.executedAt`/`executedByUserId`, `createdEntityId`/`createdEntityType`
  - `packages/core/src/modules/inbox_ops/lib/executionEngine.ts`: sets `executedAt` and `executedByUserId` on accept, emits `inbox_ops.action.executed`
  - `packages/core/src/modules/sales/api/quotes/send/route.ts`: sets `SalesQuote.sentAt`
  - `packages/core/src/modules/dashboards/lib/aggregations.ts`: aggregates limited to count/sum/avg/min/max — no median/percentile, no duration measure
  - `packages/core/src/modules/sales/analytics.ts`: `sales:quotes` analytics without time-to-quote or salesperson dimension
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/inbox_ops/lib/executionEngine.ts`
  - C2: gap: no widget or analytics entity computing inquiry → quote-sent time, and no median aggregate for per-salesperson per-period display
- **Grounding query**: `dashboards/lib/aggregations`
- **Grounding source**: core
- **Gaps**:
  - Median/percentile aggregate in the dashboards engine
  - Derived time-to-quote measure (timestamps spread over three tables)
  - No `inbox_ops/analytics.ts`; no salesperson dimension on quote analytics
  - `InboxProposal.reviewedAt` not set on the normal accept path; quotes sent outside the send route leave `sentAt` empty
- **Effort**: 4
- **Suggested implementation path**:
  - Subscriber on `inbox_ops.action.executed` and quote-sent writing a per-case metric row with `time_to_quote_seconds` (primitives checked: event bus; workflows/business_rules provide no duration metrics)
  - Register it in a new `inbox_ops/analytics.ts` following `sales/analytics.ts`
  - Add a `median` aggregate to `dashboards/lib/aggregations.ts` — FLAG: platform contribution to shared `dashboards`
  - Dashboard widget following `sales/widgets/dashboard/new-quotes`
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 8.2: Konwersja ofert
- **Description**: Jako właściciel chcę widzieć, ile ofert zostało wygranych (zamienionych w zamówienie), a ile przegranych, per handlowiec i klient.
- **Acceptance criteria**:
  - [ ] Oferta ma status wygrana lub przegrana (z powodem)
  - [ ] Dashboard pokazuje konwersję ofert jako N/M per handlowiec i okres
- **Source**: pdf p.3 (decydent mierzy więcej wygranych ofert), pdf p.4 (konwersja ofert)
- **Priority**: P1
- **Dependencies**: 5.5
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/sales/data/entities.ts`: `SalesQuote` has status and `convertedOrderId` but no owner/salesperson, loss reason or closure outcome
  - `packages/core/src/modules/sales/lib/dictionaries.ts`: quotes reuse the order-status dictionary; no quote won/lost or loss-reason vocabulary
  - `packages/core/src/modules/sales/api/quotes/accept/route.ts`: acceptance sets `confirmed` (implicit win), nothing captures lost-with-reason
  - `packages/core/src/modules/sales/widgets/dashboard/new-quotes/widget.ts`: only quote widget, no conversion ratio
  - `packages/core/src/modules/customers/api/deals/summary/route.ts`: win-rate KPI with loss reasons exists only for CRM deals
- **Criteria coverage**:
  - C1: gap: quotes have no won/lost outcome and no loss reason
  - C2: gap: no conversion N/M per salesperson and period; quotes have no salesperson field
- **Grounding query**: `quoteLossReason`
- **Grounding source**: core
- **Gaps**:
  - Quote closure outcome, loss-reason dictionary and mark-lost command
  - Quote owner/salesperson field
  - Quote conversion analytics and widget
- **Effort**: 4
- **Suggested implementation path**:
  - Primitives checked: dashboards widget framework, `sales/analytics.ts`, `business_rules`/`workflows`, customers deal-closure pattern (`deal-loss-reasons`, deals summary win rate)
  - Add `closure_outcome`, `loss_reason_id`, `loss_notes`, `owner_user_id` to quotes + `quote-loss-reasons` dictionary — FLAG: platform contribution to `sales`
  - Set won on convert/accept; mark-lost command, route and dialog
  - `quote-conversion` widget modelled on the deals `winRate()`; app-only fallback: track quotes as CRM deals
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 8.3: Trafność dopasowań i obciążenie handlowców
- **Description**: Jako kierownik chcę widzieć trafność dopasowań (top-1, top-3 według korekt), liczbę poprawek i liczbę ofert na handlowca, bez ujawniania treści korespondencji w raportach.
- **Acceptance criteria**:
  - [ ] Trafność top-1 i top-3 jest liczona z akceptacji i korekt handlowców
  - [ ] Raport zawiera liczbę ofert i poprawek na handlowca
  - [ ] Raport pokazuje agregaty, a nie treść wiadomości klientów
- **Source**: pdf p.3 (liczba poprawek), pdf p.13 (kryterium top-1 ≥60%), pdf p.14 (ryzyko 8: metryki pokazywane handlowcowi)
- **Priority**: P1
- **Dependencies**: 5.2
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/3)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: actions store final payload, status, confidence, `executedByUserId`; no ranked candidates, original suggestion or correction rank
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/actions/[actionId]/route.ts`: edit merges over the original; `inbox_ops.action.edited` has no user id or diff
  - `packages/core/src/modules/inbox_ops/api/proposals/counts/route.ts`: only status/category counts
  - `packages/core/src/modules/sales/analytics.ts`: no salesperson dimension on quotes
  - `packages/core/src/modules/dashboards/services/analyticsRegistry.ts`: reusable aggregate-widget engine
- **Criteria coverage**:
  - C1: gap: no top-1/top-3 accuracy calculation; candidates and original suggestion are not stored
  - C2: gap: no quotes/corrections per salesperson report; edits are not attributed
  - C3: gap: no accuracy/workload report exists at all, hence no aggregates-only view
- **Grounding query**: `accuracyPerSalesperson`
- **Grounding source**: core
- **Gaps**:
  - Ranked candidates and original suggestion per action
  - User id and correction diff on edit/accept events
  - Salesperson dimension on quotes
  - Aggregate report API/UI with manager-only ACL returning counts and rates only
- **Effort**: 4
- **Suggested implementation path**:
  - Primitives checked: dashboards `analyticsRegistry`, enterprise `metricRollupService`, inbox_ops events/subscribers
  - Store `matchCandidates`/`originalPayload` at extraction; add `userId` to edit/accept events (additive)
  - Persistent subscriber writing content-free `inbox_match_outcomes` rows; register `inbox_ops/analytics.ts` and widgets
  - ACL `inbox_ops.analytics.view` for managers — FLAG: changes to `inbox_ops`/`sales` are platform contributions; only the widget can live in the app
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

## Epic 9: Platforma SaaS — wielodostępność, prywatność, audyt, kanał partnerski
**Goal**: Wiele niezależnych hurtowni działa na jednej instancji z pełną izolacją danych, zgodnie z RODO, z audytem decyzji i opcją dystrybucji przez grupę zakupową.
**Business value**: Model SaaS dla 60–150 klientów (pdf p.6) i kanał przez grupy zakupowe (pdf p.1, p.14 ryzyko 4) wymagają multi-tenancy i white-label.

#### Coverage
- negative-path: Story 9.5
- abuse-case: Story 9.1
- race-condition: out-of-scope: epik dotyczy konfiguracji i uprawnień; współbieżność zapisów obsługują Story 1.7, 5.7 i 6.5
- tenant-isolation: Story 9.1
- data-privacy: Story 9.2
- audit-log: Story 9.3
- data-quality: out-of-scope: jakość danych katalogowych obsługuje Epic 7 (Story 7.4)

### Story 9.1: Izolacja danych między hurtowniami
- **Description**: Jako hurtownia chcę mieć pewność, że moje wiadomości, katalog, ceny, oferty i metryki nie są widoczne dla innych hurtowni na tej samej instancji.
- **Acceptance criteria**:
  - [ ] Wszystkie encje inboxa, dopasowań i ofert są filtrowane po tenant i organizacji
  - [ ] Próba odczytu rekordu innego tenanta przez API zwraca brak dostępu lub brak rekordu
- **Source**: pdf p.6 (SAM: 1,5–2,5 tys. firm; cel 60–150 klientów w modelu abonamentowym)
- **Priority**: P0
- **Dependencies**: none
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ✅ Implemented (2/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/data/entities.ts`: all inbox entities carry required `organizationId`/`tenantId` with composite indexes
  - `packages/core/src/modules/inbox_ops/api/routeHelpers.ts`: `resolveRequestContext` fails closed without tenant/org and builds the scope for every route
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/route.ts`: scoped lookups; 404 outside the caller's scope
  - `packages/core/src/modules/inbox_ops/lib/catalogLookup.ts`: catalog matching filtered by tenant and organization
  - `packages/shared/src/lib/crud/factory.ts`: `makeCrudRoute` applies org/tenant scoping by default (`orgField`/`tenantField`)
  - `packages/core/src/modules/sales/__integration__/TC-SALES-039-public-quote-tenant-guard.spec.ts`: cross-tenant guard integration test
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/inbox_ops/data/entities.ts`
  - C2: covered `packages/core/src/modules/inbox_ops/api/proposals/[id]/route.ts`
- **Grounding query**: `tenantField`
- **Grounding source**: core
- **Gaps**:
  - none at platform level; new app entities must follow the same `organizationId`/`tenantId` pattern
- **Effort**: 0
- **Suggested implementation path**:
  - App entities with required tenant/org columns and indexes; expose via `makeCrudRoute` with default scoping; custom routes use `findOneWithDecryption` with scope
  - Optional per-app cross-tenant integration test modelled on TC-SALES-039
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 9.2: RODO dla treści wiadomości i załączników
- **Description**: Jako hurtownia chcę, żeby dane osobowe z wiadomości (nadawca, telefon, treść) były szyfrowane, miały retencję i dało się je zanonimizować na żądanie.
- **Acceptance criteria**:
  - [ ] Pola z danymi osobowymi w wiadomościach są szyfrowane w spoczynku
  - [ ] Wiadomości i załączniki mają konfigurowalny okres retencji i można je usunąć lub zanonimizować
- **Source**: pdf p.13 (walidacja: zebranie 100 prawdziwych, zanonimizowanych zapytań od 5 hurtowni)
- **Priority**: P0
- **Dependencies**: 1.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/encryption.ts`: encrypts inbound email PII at rest (subject, raw text/html, cleaned text, thread messages, addresses) plus proposal participants/summary and action payloads
  - `packages/core/src/modules/messages/encryption.ts`: encrypts message subject/body/external email (blind index)/name
  - `packages/core/src/modules/communication_channels/encryption.ts`: only dead-letter raw body; hub copies (`external_messages.sender_identifier`, conversation subject, channel payload) remain plaintext
  - `packages/core/src/modules/inbox_ops/api/emails/[id]/route.ts`: DELETE is soft delete only; no purge or anonymization
  - `packages/core/src/modules/integrations/workers/log-pruner.ts`: reusable scheduled-prune worker pattern (retention exists only for logs/token usage)
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/inbox_ops/encryption.ts`
  - C2: gap: no configurable retention for inbox emails/messages/attachments; soft delete only; no anonymize-on-request command
- **Grounding query**: `inbox_ops/encryption`
- **Grounding source**: core
- **Gaps**:
  - Retention setting and scheduled purge worker (emails, messages, external messages, attachments)
  - Anonymization command (none exists in core)
  - Soft-deleted PII and attachment blobs retained indefinitely
  - Plaintext hub copies in `communication_channels`; attachment blobs not encrypted at storage level
- **Effort**: 4
- **Suggested implementation path**:
  - Primitives checked: scheduler + queue prune workers, encryption maps, hard-delete cascades, deferred communication_channels cascade; no workflows/business_rules primitive for retention
  - Retention config in inbox_ops settings; prune worker modelled on `log-pruner.ts` deleting attachments via the attachments service
  - `inbox_ops.emails.anonymize` command with audit entry, API route and backend action
  - Optional encryption maps with blind-index hashes for hub copies — FLAG: platform contribution to `inbox_ops`/`communication_channels`; coordinate with the enterprise GDPR erasure spec and PR #6702 (CHANGES_REQUESTED)
- **Upstream pipeline**: spec: .ai/specs/enterprise/2026-07-08-gdpr-data-erasure.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 9.3: Audyt decyzji AI i akcji handlowca
- **Description**: Jako kierownik chcę wiedzieć, co zaproponował system, kto zaakceptował lub zmienił propozycję i co zostało wysłane do klienta oraz ERP.
- **Acceptance criteria**:
  - [ ] Każda propozycja, akceptacja, odrzucenie i zapis do ERP jest zapisany w logu audytu z użytkownikiem i czasem
  - [ ] Zmiany pozycji przez handlowca są widoczne jako różnica względem propozycji
- **Source**: pdf p.4 (model propozycja → dyspozycja → efektor), pdf p.14 (ryzyko 8)
- **Priority**: P1
- **Dependencies**: 5.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: ❌ Missing (0/2)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/subscribers/executionAuditor.ts`: calls `dataEngine.audit?.()` which does not exist on `DataEngine` — a no-op writing nothing to the audit log
  - `packages/core/src/modules/inbox_ops/lib/executionEngine.ts`: stamps `executedByUserId`/`executedAt` on rows and emits events, but writes no `action_logs` entries
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/actions/[actionId]/route.ts`: PATCH overwrites the AI payload in place
  - `packages/core/src/modules/audit_logs/data/entities.ts`: `ActionLog` with snapshot before/after and changes — the primitive to reuse
- **Criteria coverage**:
  - C1: gap: proposal creation, acceptance, rejection and ERP write are not recorded in the audit log with user and time
  - C2: gap: edits overwrite the original proposal; no before/after snapshot or diff
- **Grounding query**: `proposalAuditTrail`
- **Grounding source**: core
- **Gaps**:
  - Broken `executionAuditor`; no `action_logs` entries for inbox_ops lifecycle events or links to downstream command logs
  - Original AI payload lost on first edit
  - No history timeline in proposal detail UI
  - No ERP write step to audit (depends on the ERP connector stories)
- **Effort**: 3
- **Suggested implementation path**:
  - FLAG: contribution to shared platform module `inbox_ops`
  - Replace `executionAuditor` with persistent subscribers on `inbox_ops.*` events calling `ActionLogService.log()` with actor, resource and parent resource (primitive checked: audit_logs; workflows/business_rules/notifications provide no audit trail)
  - Preserve `originalPayload`; log snapshots/diffs on PATCH
  - History panel in proposal detail reading `action_logs`; log ERP export entries once the connector exists
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)

### Story 9.4: White-label i model partnerski dla grupy zakupowej
- **Description**: Jako grupa zakupowa (SBS, PHI, EL-Plus) chcę oferować produkt swoim członkom pod własną marką i dostarczać centralne dane katalogowe wszystkim hurtowniom grupy.
- **Acceptance criteria**:
  - [ ] Grupa może mieć wiele hurtowni członkowskich jako osobne organizacje lub tenanty pod jednym partnerem
  - [ ] Wygląd (logo, nazwa) jest konfigurowalny per partner
  - [ ] Centralny katalog grupy może być współdzielony przez hurtownie członkowskie
- **Source**: pdf p.1 (kanał przez grupy zakupowe), pdf p.14 (ryzyko 4: oferta white-label lub partnerska dla grup)
- **Priority**: P2
- **Dependencies**: 9.1
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (2/3, core)
- **Evidence**:
  - `packages/core/src/modules/directory/data/entities.ts`: `Tenant`/`Organization` with a hierarchy (`parentId`, `ancestorIds`, `descendantIds`) and `logo_url`
  - `packages/core/src/modules/directory/utils/organizationScope.ts`: scope expands to descendants only; children do not see ancestor records
  - `packages/core/src/modules/directory/api/organization-branding/route.ts`: per-organization branding (logo) API
  - `packages/core/src/modules/auth/lib/backendChrome.tsx`: backend chrome brand from the selected organization
  - `packages/core/src/modules/directory/__integration__/TC-DIR-013-organization-sidebar-branding.spec.ts`: branding integration test
  - `packages/core/src/modules/catalog/data/entities.ts`: catalog records belong to one organization; no shared ownership
- **Criteria coverage**:
  - C1: covered `packages/core/src/modules/directory/data/entities.ts`
  - C2: covered `packages/core/src/modules/directory/api/organization-branding/route.ts`
  - C3: gap: no shared/central catalog — member organizations cannot read a group catalog and there is no publish/subscribe across organizations
- **Grounding query**: `organization-branding`
- **Grounding source**: core
- **Gaps**:
  - Central group catalog shared with member wholesalers
  - Branding without inheritance (per-org logo only; no per-partner theme/login branding)
  - No explicit partner concept (model as parent organization or tenant)
- **Effort**: 4
- **Suggested implementation path**:
  - Purchasing group as parent organization, member wholesalers as children (no code change); separate tenants when hard isolation is needed
  - App-level group catalog feed copying group catalog into member orgs via catalog commands on `data_sync` + events/queue (primitives checked)
  - FLAG: ancestor-inherited read scoping in `organizationScope` or ancestor logo fallback in `backendChrome.tsx` are platform contributions; per-partner theming out of MVP scope
- **Upstream pipeline**: spec: .ai/specs/2026-07-05-ds-theming-and-brand-customization.md (planned, unbuilt)
- **Investigated**: 2026-09-30 (gate PASS)

### Story 9.5: Role i uprawnienia (handlowiec, kierownik, administrator)
- **Description**: Jako administrator hurtowni chcę nadać handlowcom dostęp do inboxa i ofert, kierownikom do metryk i progów, a sobie do integracji, żeby odmowa dostępu działała poprawnie.
- **Acceptance criteria**:
  - [ ] Akcje inboxa, akceptacji, konfiguracji progów i integracji są chronione osobnymi uprawnieniami
  - [ ] Użytkownik bez uprawnienia dostaje odmowę w API i nie widzi akcji w interfejsie
- **Source**: pdf p.3 (role: decydent, użytkownik główny, użytkownik pomocniczy)
- **Priority**: P1
- **Dependencies**: none
- **Status**: done

#### Gap analysis
<!-- Filled by phase 2 via the gate. Do not edit by hand. -->
- **Verdict**: 🟡 Partial (1/2, core)
- **Evidence**:
  - `packages/core/src/modules/inbox_ops/acl.ts`: features `inbox_ops.proposals.view`, `.proposals.manage`, `.settings.manage`, `.log.view`, `.replies.send`
  - `packages/core/src/modules/inbox_ops/setup.ts`: `admin` gets all; `employee` gets view/manage/reply
  - `packages/core/src/modules/inbox_ops/api/proposals/[id]/accept-all/route.ts`: accept/reject/edit require `inbox_ops.proposals.manage` (API denial works)
  - `packages/core/src/modules/inbox_ops/api/settings/route.ts`: settings gated by `inbox_ops.settings.manage`
  - `packages/core/src/modules/integrations/acl.ts`: separate `integrations.view`/`.manage`/`.credentials.manage`
  - `packages/core/src/modules/auth/backend/roles`: custom role admin UI
- **Criteria coverage**:
  - C1: gap: inbox and integration permissions are separate, but acceptance shares `inbox_ops.proposals.manage` with editing and there are no threshold/metrics permissions (neither is modelled)
  - C2: covered `packages/core/src/modules/inbox_ops/api/proposals/[id]/accept-all/route.ts`
- **Grounding query**: `inbox_ops.proposals.manage`
- **Grounding source**: core
- **Gaps**:
  - No separate `inbox_ops.proposals.accept` feature
  - No threshold/metrics features or settings (price threshold is env-only)
  - No default manager role (only superadmin/admin/employee seeded)
  - Proposal UI shows Accept/Reject to view-only users (API returns 403)
- **Effort**: 3
- **Suggested implementation path**:
  - Add `inbox_ops.proposals.accept`, switch accept routes, grant to existing roles for BC — FLAG: platform contribution to `inbox_ops`
  - Thresholds/metrics features in `InboxSettings` or an app module `acl.ts`, gated with `requireFeatures`/`page.meta.ts`
  - Hide buttons via `hasFeature` (pattern: `sales/backend/sales/documents/[id]/page.tsx`); seed a manager role in the app `setup.ts`
  - Primitives checked: auth RBAC, feature ACLs, roles UI
- **Upstream pipeline**: none
- **Investigated**: 2026-09-30 (gate PASS)
