/** @format */

import { describe, it, expect, beforeEach } from "vitest";
import {
  noneCV,
  OptionalCV,
  principalCV,
  stringUtf8CV,
  uintCV,
  boolCV,
  bufferCV,
} from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_DOCTOR_NOT_FOUND = 101;
const ERR_CREDENTIAL_NOT_FOUND = 102;
const ERR_CREDENTIAL_EXPIRED = 103;
const ERR_CREDENTIAL_REVOKED = 104;
const ERR_INVALID_ISSUER = 105;
const ERR_INVALID_HASH = 106;
const ERR_INVALID_VERIFICATION_FEE = 117;

interface Verification {
  doctor: string;
  patient: string | null;
  sessionId: number | null;
  credentialHash: Uint8Array;
  expiration: number;
  issuer: string;
  specialty: string;
  region: string;
  timestamp: number;
  status: boolean;
  revoked: boolean;
}

interface Credential {
  expiration: number;
  issuer: string;
  specialty: string;
  region: string;
  revoked: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class VerificationEngineMock {
  state = {
    nextVerificationId: 0,
    verificationFee: 500,
    adminPrincipal: "ST1ADMIN",
    credentialIssuerContract: null as string | null,
    doctorRegistryContract: null as string | null,
    credentialStorageContract: null as string | null,
    verifications: new Map<number, Verification>(),
    doctorVerificationCount: new Map<string, number>(),
  };
  blockHeight = 0;
  caller = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];
  mockCredentials = new Map<string, Credential>();
  mockDoctors = new Set<string>();

  reset() {
    this.state = {
      nextVerificationId: 0,
      verificationFee: 500,
      adminPrincipal: "ST1ADMIN",
      credentialIssuerContract: null,
      doctorRegistryContract: null,
      credentialStorageContract: null,
      verifications: new Map(),
      doctorVerificationCount: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
    this.mockCredentials = new Map();
    this.mockDoctors = new Set();
  }

  setCredentialIssuerContract(contract: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal)
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.credentialIssuerContract = contract;
    return { ok: true, value: true };
  }

  setDoctorRegistryContract(contract: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal)
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.doctorRegistryContract = contract;
    return { ok: true, value: true };
  }

  setCredentialStorageContract(contract: string): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal)
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.credentialStorageContract = contract;
    return { ok: true, value: true };
  }

  setVerificationFee(newFee: number): Result<boolean> {
    if (this.caller !== this.state.adminPrincipal)
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFee <= 0) return { ok: false, value: ERR_INVALID_VERIFICATION_FEE };
    this.state.verificationFee = newFee;
    return { ok: true, value: true };
  }

  verifyCredential(
    doctor: string,
    credentialHash: Uint8Array,
    patient: string | null,
    sessionId: number | null
  ): Result<number> {
    const hashKey = Buffer.from(credentialHash).toString("hex");
    if (!this.mockDoctors.has(doctor))
      return { ok: false, value: ERR_DOCTOR_NOT_FOUND };
    if (credentialHash.length !== 32)
      return { ok: false, value: ERR_INVALID_HASH };
    const cred = this.mockCredentials.get(hashKey);
    if (!cred) return { ok: false, value: ERR_CREDENTIAL_NOT_FOUND };
    if (cred.expiration <= this.blockHeight)
      return { ok: false, value: ERR_CREDENTIAL_EXPIRED };
    if (cred.revoked) return { ok: false, value: ERR_CREDENTIAL_REVOKED };
    if (cred.issuer !== this.state.credentialIssuerContract)
      return { ok: false, value: ERR_INVALID_ISSUER };

    this.stxTransfers.push({
      amount: this.state.verificationFee,
      from: this.caller,
      to: this.state.adminPrincipal,
    });

    const id = this.state.nextVerificationId;
    const verification: Verification = {
      doctor,
      patient,
      sessionId,
      credentialHash,
      expiration: cred.expiration,
      issuer: cred.issuer,
      specialty: cred.specialty,
      region: cred.region,
      timestamp: this.blockHeight,
      status: true,
      revoked: false,
    };
    this.state.verifications.set(id, verification);
    const count = this.state.doctorVerificationCount.get(doctor) || 0;
    this.state.doctorVerificationCount.set(doctor, count + 1);
    this.state.nextVerificationId++;
    return { ok: true, value: id };
  }

  revokeVerification(id: number): Result<boolean> {
    const verif = this.state.verifications.get(id);
    if (!verif) return { ok: false, value: ERR_CREDENTIAL_NOT_FOUND };
    if (this.caller !== verif.issuer)
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    const updated: Verification = { ...verif, revoked: true, status: false };
    this.state.verifications.set(id, updated);
    return { ok: true, value: true };
  }

  getVerificationCount(): Result<number> {
    return { ok: true, value: this.state.nextVerificationId };
  }

  checkVerificationStatus(id: number): Result<boolean> {
    const verif = this.state.verifications.get(id);
    if (!verif) return { ok: false, value: ERR_CREDENTIAL_NOT_FOUND };
    return { ok: true, value: verif.status };
  }

  addMockDoctor(doctor: string) {
    this.mockDoctors.add(doctor);
  }

  addMockCredential(hash: Uint8Array, cred: Credential) {
    const hashKey = Buffer.from(hash).toString("hex");
    this.mockCredentials.set(hashKey, cred);
  }
}

describe("VerificationEngine", () => {
  let contract: VerificationEngineMock;

  beforeEach(() => {
    contract = new VerificationEngineMock();
    contract.reset();
  });

  it("sets credential issuer contract successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setCredentialIssuerContract("ST2ISSUER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.credentialIssuerContract).toBe("ST2ISSUER");
  });

  it("rejects setting credential issuer by non-admin", () => {
    const result = contract.setCredentialIssuerContract("ST2ISSUER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("sets verification fee successfully", () => {
    contract.caller = "ST1ADMIN";
    const result = contract.setVerificationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.verificationFee).toBe(1000);
  });

  it("verifies credential successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setCredentialIssuerContract("ST2ISSUER");
    contract.caller = "ST1TEST";
    
    const doctor = "ST3DOCTOR";
    const hash = new Uint8Array(32).fill(1);
    
    contract.addMockDoctor(doctor);
    contract.addMockCredential(hash, {
      expiration: 1000,
      issuer: "ST2ISSUER",
      specialty: "Cardiology",
      region: "North America",
      revoked: false
    });
    
    const result = contract.verifyCredential(doctor, hash, null, null);
    expect(result.ok).toBe(true);
    expect(typeof result.value).toBe("number");
  });

  it("rejects verification for non-existent doctor", () => {
    const hash = new Uint8Array(32).fill(1);
    const result = contract.verifyCredential("ST3DOCTOR", hash, null, null);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DOCTOR_NOT_FOUND);
  });

  it("revokes verification successfully", () => {
    contract.caller = "ST1ADMIN";
    contract.setCredentialIssuerContract("ST2ISSUER");
    contract.caller = "ST1TEST";
    
    const doctor = "ST3DOCTOR";
    const hash = new Uint8Array(32).fill(1);
    
    contract.addMockDoctor(doctor);
    contract.addMockCredential(hash, {
      expiration: 1000,
      issuer: "ST2ISSUER",
      specialty: "Cardiology",
      region: "North America",
      revoked: false
    });
    
    const verifyResult = contract.verifyCredential(doctor, hash, null, null);
    expect(verifyResult.ok).toBe(true);
    
    contract.caller = "ST2ISSUER";
    const revokeResult = contract.revokeVerification(verifyResult.value as number);
    expect(revokeResult.ok).toBe(true);
    expect(revokeResult.value).toBe(true);
  });

  it("gets verification count", () => {
    const result = contract.getVerificationCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
  });
});