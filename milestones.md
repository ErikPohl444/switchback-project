# Switchback Engineering Execution Roadmap & Milestones

This document translates the Milestone Source Material into a structured, sprint-by-sprint execution plan. It integrates team dynamics, architectural decisions (`DECISIONS.md`), cross-squad contracts, and risk-mitigated rollout gates.

---

## Sprint 1: Architecture, Cross-Squad Contracts & Infrastructure Scaffold

**Focus:** Co-create execution plan with Priya, establish external squad contracts, secure Director sign-off, provision AWS infrastructure, and lock down networking/secrets.

- [ ] Develop requirements and requested due dates for Enterprise API squad
- [ ] Develop requirements and requested due dates for Supply API squad
- [ ] Develop high level milestones and review with Priya _(Focus: Priya leadership alignment & team growth)_
- [ ] Plan review with Director
- [ ] Provide requirements and requested due dates to Enterprise API squad
- [ ] Provide requirements and requested due dates to Supply squad
- [ ] Meet with supply squad manager and enterprise api squad manager to align on expectations and confirm deadlines _(Output: confirmed plan)_
- [ ] Marcus develops project plan _(Focus: Marcus technical project management ownership)_
- [ ] Conduct Switchback Project Kickoff Meeting
- [ ] Priya schedules check-ins with Marcus
- [ ] Priya and team develop tickets for Switchback project
- [ ] Architecture & Security Review sign-off on zero-trust identity and tenant-isolation boundaries _(Tying to [DECISIONS.md](./DECISIONS.md))_
- [ ] Environment Provisioning & IaC setup for Staging and Canary infrastructure (schemas, secrets, connection pooling)
- [ ] AWS VPC, PrivateLink endpoints & Security Group lockdown for cross-squad endpoints
- [ ] AWS Secrets Manager, SSM Parameter Store & IAM execution roles setup (including automated secret rotation)

---

## Sprint 2: Core Feature Engineering, Telemetry Instrumentation & Contract Lock

**Focus:** Build resiliency mechanisms, zero-trust token handoffs, instrument New Relic custom attributes, and lock cross-squad API contract schemas.

- [ ] Unit testing of the SSO identity handoff _(Priya / Token verification contract)_
- [ ] Code review of the SSO identity handoff
- [ ] Unit testing of the degraded-mode fallback _(Dana / Resiliency architecture)_
- [ ] Code review of the degraded-mode fallback
- [ ] Unit testing of the tenant-isolation guardrail _(Sam / Repository whitelist guardrail)_
- [ ] Code review of the tenant-isolation guardrail
- [ ] Internal System Integration Testing (Switchback internal components, stubs, and local domain boundaries)
- [ ] New Relic APM agent instrumentation & custom attribute mapping (`tenant_id`, `request_type`)
- [ ] Audit Logging, PII Masking & Data Retention Compliance Review
- [ ] Formal Cross-Squad API Contract Freeze (Enterprise API & Supply squads)

---

## Sprint 3: Cross-Squad Integration, Resilience, Observability & Incident Orchestration

**Focus:** Connect to live squad endpoints, stress-test ECS auto-scaling, execute active fault injection, configure Rootly incident triggers, and set up New Relic synthetics/alerts.

- [ ] Switchback System Integration Testing (End-to-end integration testing with Enterprise API and Supply squad endpoints)
- [ ] AWS ECS Auto-scaling & database connection pool scaling stress test
- [ ] Load & Capacity testing to validate throughput limits and database connection pool scaling
- [ ] Performance testing (Benchmarking p99 latency SLAs, response times, and memory utilization under sustained traffic)
- [ ] Chaos & Fallback testing (fault injection to verify circuit breakers and degraded-mode behavior)
- [ ] Automated Rollback & Failback Dry-Run Validation in Staging
- [ ] Security & Vulnerability Audit (final SAST/DAST/SCA and pen-test sign-off)
- [ ] Observability & Alerting setup (dashboards, APM tracing, log aggregation, threshold alerts)
- [ ] New Relic Synthetic monitor script configuration for canary validation
- [ ] New Relic NRQL Alert condition & webhook trigger setup (connecting to Rootly)
- [ ] Populate Rootly Incident Workflows & Severity Escalation Matrix
- [ ] Runbook & Operational Playbook creation (rollback procedures and circuit breaker overrides)
- [ ] On-Call & Support Escalation alignment (PagerDuty routing and hypercare schedule)

---

## Sprint 4: Launch Governance, Phased Canary Rollout & Decommissioning

**Focus:** Secure formal change board approvals, execute automated synthetic and traffic-escalated canary deployment, complete 100% cutover, and enter hypercare.

- [ ] Production Go/No-Go Gate meeting with EM, Priya, Marcus, and cross-team leads
- [ ] Change Control Review with Switchback pre-deployment (CAB / Release Advisory Board formal change window sign-off)
- [ ] Deploy Offers Service to Staging & Execute Automated CI/CD Security Gates
- [ ] Deploy to Production Canary Environment & Initialize Operational Monitoring
- [ ] Execute 1% Synthetic Traffic Canary & Automated Circuit Breaker Validation
- [ ] Initiate 1% Live Production Traffic Canary Rollout _(Risk Gate)_
- [ ] Promote Canary Traffic to 10% Production Volume
- [ ] Promote Canary Traffic to 25% Production Volume
- [ ] Promote Canary Traffic to 50% Production Volume
- [ ] Complete 100% Production Traffic Cutover & Baseline Decommissioning _(Milestone Achievement)_
- [ ] Post-deployment hypercare
- [ ] Legacy Service Decommissioning Plan execution
- [ ] Project Retrospective & formal delivery sign-off
