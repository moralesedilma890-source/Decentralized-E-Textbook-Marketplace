// TextbookNFT.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface TokenMetadata {
  "content-hash": Uint8Array; // buff 32
  title: string;
  description: string;
  "initial-price": number;
  uri: string | null;
  "mint-timestamp": number;
}

interface Royalty {
  recipient: string;
  percentage: number;
}

interface Version {
  "updated-hash": Uint8Array;
  "update-notes": string;
  timestamp: number;
}

interface License {
  expiry: number;
  terms: string;
  active: boolean;
}

interface Category {
  category: string;
  tags: string[];
}

interface Collaborator {
  role: string;
  permissions: string[];
  "added-at": number;
}

interface Status {
  status: string;
  visibility: boolean;
  "last-updated": number;
}

interface RevenueShare {
  percentage: number;
  "total-received": number;
}

interface ContractState {
  tokenOwners: Map<number, string>;
  tokenMetadata: Map<number, TokenMetadata>;
  tokenRoyalties: Map<number, Royalty>;
  tokenVersions: Map<string, Version>; // key: `${token-id}-${version}`
  tokenLicenses: Map<string, License>; // key: `${token-id}-${licensee}`
  tokenCategories: Map<number, Category>;
  tokenCollaborators: Map<string, Collaborator>; // key: `${token-id}-${collaborator}`
  tokenStatus: Map<number, Status>;
  revenueShares: Map<string, RevenueShare>; // key: `${token-id}-${participant}`
  contractAdmin: string;
  paused: boolean;
  tokenCounter: number;
  totalRoyaltiesCollected: number;
}

// Mock contract implementation
class TextbookNFTMock {
  private state: ContractState = {
    tokenOwners: new Map(),
    tokenMetadata: new Map(),
    tokenRoyalties: new Map(),
    tokenVersions: new Map(),
    tokenLicenses: new Map(),
    tokenCategories: new Map(),
    tokenCollaborators: new Map(),
    tokenStatus: new Map(),
    revenueShares: new Map(),
    contractAdmin: "deployer",
    paused: false,
    tokenCounter: 0,
    totalRoyaltiesCollected: 0,
  };

  private ERR_NOT_AUTHORIZED = 100;
  private ERR_PAUSED = 101;
  private ERR_INVALID_TOKEN_ID = 102;
  private ERR_INVALID_AMOUNT = 103;
  private ERR_INVALID_RECIPIENT = 104;
  private ERR_ALREADY_REGISTERED = 105;
  private ERR_METADATA_TOO_LONG = 106;
  private ERR_ROYALTY_TOO_HIGH = 107;
  private ERR_NOT_OWNER = 108;
  private ERR_TOKEN_NOT_EXISTS = 109;
  private ERR_INVALID_HASH = 110;
  private ERR_VERSION_ALREADY_EXISTS = 111;
  private ERR_LICENSE_EXPIRED = 112;
  private ERR_INVALID_CATEGORY = 113;
  private ERR_TOO_MANY_TAGS = 114;
  private ERR_INVALID_PERMISSION = 115;
  private ERR_INVALID_STATUS = 116;
  private ERR_SHARE_EXCEEDS_100 = 117;
  private MAX_METADATA_LEN = 500;
  private MAX_TAGS = 10;
  private MAX_PERMISSIONS = 5;
  private MAX_ROYALTY_PERCENT = 1000;

  private mockBlockHeight = 1000; // Simulated block height

  private incrementBlockHeight() {
    this.mockBlockHeight += 1;
  }

  mintTextbook(
    caller: string,
    contentHash: Uint8Array,
    title: string,
    description: string,
    initialPrice: number,
    uri: string | null
  ): ClarityResponse<number> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    if (contentHash.length !== 32) {
      return { ok: false, value: this.ERR_INVALID_HASH };
    }
    if (description.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_METADATA_TOO_LONG };
    }
    const tokenId = ++this.state.tokenCounter;
    this.state.tokenOwners.set(tokenId, caller);
    this.state.tokenMetadata.set(tokenId, {
      "content-hash": contentHash,
      title,
      description,
      "initial-price": initialPrice,
      uri,
      "mint-timestamp": this.mockBlockHeight,
    });
    this.state.tokenStatus.set(tokenId, {
      status: "active",
      visibility: true,
      "last-updated": this.mockBlockHeight,
    });
    this.incrementBlockHeight();
    return { ok: true, value: tokenId };
  }

  transfer(
    caller: string,
    tokenId: number,
    sender: string,
    recipient: string
  ): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const owner = this.state.tokenOwners.get(tokenId);
    if (!owner || owner !== caller || sender !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    this.state.tokenOwners.set(tokenId, recipient);
    return { ok: true, value: true };
  }

  burn(caller: string, tokenId: number): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const owner = this.state.tokenOwners.get(tokenId);
    if (!owner || owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    this.state.tokenOwners.delete(tokenId);
    this.state.tokenMetadata.delete(tokenId);
    this.state.tokenRoyalties.delete(tokenId);
    this.state.tokenCategories.delete(tokenId);
    this.state.tokenStatus.delete(tokenId);
    // Simulate deletion of other maps
    return { ok: true, value: true };
  }

  setRoyalty(
    caller: string,
    tokenId: number,
    recipient: string,
    percentage: number
  ): ClarityResponse<boolean> {
    const owner = this.state.tokenOwners.get(tokenId);
    if (!owner || owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (percentage > this.MAX_ROYALTY_PERCENT) {
      return { ok: false, value: this.ERR_ROYALTY_TOO_HIGH };
    }
    this.state.tokenRoyalties.set(tokenId, { recipient, percentage });
    return { ok: true, value: true };
  }

  registerNewVersion(
    caller: string,
    tokenId: number,
    version: number,
    updatedHash: Uint8Array,
    notes: string
  ): ClarityResponse<boolean> {
    const owner = this.state.tokenOwners.get(tokenId);
    if (!owner || owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const key = `${tokenId}-${version}`;
    if (this.state.tokenVersions.has(key)) {
      return { ok: false, value: this.ERR_VERSION_ALREADY_EXISTS };
    }
    if (updatedHash.length !== 32) {
      return { ok: false, value: this.ERR_INVALID_HASH };
    }
    this.state.tokenVersions.set(key, {
      "updated-hash": updatedHash,
      "update-notes": notes,
      timestamp: this.mockBlockHeight,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  grantLicense(
    caller: string,
    tokenId: number,
    licensee: string,
    duration: number,
    terms: string
  ): ClarityResponse<boolean> {
    const owner = this.state.tokenOwners.get(tokenId);
    if (!owner || owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const key = `${tokenId}-${licensee}`;
    this.state.tokenLicenses.set(key, {
      expiry: this.mockBlockHeight + duration,
      terms,
      active: true,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  revokeLicense(
    caller: string,
    tokenId: number,
    licensee: string
  ): ClarityResponse<boolean> {
    const owner = this.state.tokenOwners.get(tokenId);
    if (!owner || owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    const key = `${tokenId}-${licensee}`;
    const license = this.state.tokenLicenses.get(key);
    if (!license) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    this.state.tokenLicenses.set(key, { ...license, active: false });
    return { ok: true, value: true };
  }

  addCategory(
    caller: string,
    tokenId: number,
    category: string,
    tags: string[]
  ): ClarityResponse<boolean> {
    const owner = this.state.tokenOwners.get(tokenId);
    if (!owner || owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (tags.length > this.MAX_TAGS) {
      return { ok: false, value: this.ERR_TOO_MANY_TAGS };
    }
    this.state.tokenCategories.set(tokenId, { category, tags });
    return { ok: true, value: true };
  }

  addCollaborator(
    caller: string,
    tokenId: number,
    collaborator: string,
    role: string,
    permissions: string[]
  ): ClarityResponse<boolean> {
    const owner = this.state.tokenOwners.get(tokenId);
    if (!owner || owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (permissions.length > this.MAX_PERMISSIONS) {
      return { ok: false, value: this.ERR_INVALID_PERMISSION };
    }
    const key = `${tokenId}-${collaborator}`;
    this.state.tokenCollaborators.set(key, {
      role,
      permissions,
      "added-at": this.mockBlockHeight,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  updateStatus(
    caller: string,
    tokenId: number,
    status: string,
    visibility: boolean
  ): ClarityResponse<boolean> {
    const owner = this.state.tokenOwners.get(tokenId);
    if (!owner || owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    this.state.tokenStatus.set(tokenId, {
      status,
      visibility,
      "last-updated": this.mockBlockHeight,
    });
    this.incrementBlockHeight();
    return { ok: true, value: true };
  }

  setRevenueShare(
    caller: string,
    tokenId: number,
    participant: string,
    percentage: number
  ): ClarityResponse<boolean> {
    const owner = this.state.tokenOwners.get(tokenId);
    if (!owner || owner !== caller) {
      return { ok: false, value: this.ERR_NOT_OWNER };
    }
    if (percentage > 100) {
      return { ok: false, value: this.ERR_SHARE_EXCEEDS_100 };
    }
    const key = `${tokenId}-${participant}`;
    this.state.revenueShares.set(key, {
      percentage,
      "total-received": 0,
    });
    return { ok: true, value: true };
  }

  setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractAdmin) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    this.state.contractAdmin = newAdmin;
    return { ok: true, value: true };
  }

  pause(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractAdmin) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpause(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractAdmin) {
      return { ok: false, value: this.ERR_NOT_AUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  getOwner(tokenId: number): ClarityResponse<string | null> {
    return { ok: true, value: this.state.tokenOwners.get(tokenId) ?? null };
  }

  getMetadata(tokenId: number): ClarityResponse<TokenMetadata | null> {
    return { ok: true, value: this.state.tokenMetadata.get(tokenId) ?? null };
  }

  getRoyalty(tokenId: number): ClarityResponse<Royalty | null> {
    return { ok: true, value: this.state.tokenRoyalties.get(tokenId) ?? null };
  }

  getVersion(tokenId: number, version: number): ClarityResponse<Version | null> {
    const key = `${tokenId}-${version}`;
    return { ok: true, value: this.state.tokenVersions.get(key) ?? null };
  }

  getLicense(tokenId: number, licensee: string): ClarityResponse<License | null> {
    const key = `${tokenId}-${licensee}`;
    return { ok: true, value: this.state.tokenLicenses.get(key) ?? null };
  }

  getCategory(tokenId: number): ClarityResponse<Category | null> {
    return { ok: true, value: this.state.tokenCategories.get(tokenId) ?? null };
  }

  getCollaborator(tokenId: number, collaborator: string): ClarityResponse<Collaborator | null> {
    const key = `${tokenId}-${collaborator}`;
    return { ok: true, value: this.state.tokenCollaborators.get(key) ?? null };
  }

  getStatus(tokenId: number): ClarityResponse<Status | null> {
    return { ok: true, value: this.state.tokenStatus.get(tokenId) ?? null };
  }

  getRevenueShare(tokenId: number, participant: string): ClarityResponse<RevenueShare | null> {
    const key = `${tokenId}-${participant}`;
    return { ok: true, value: this.state.revenueShares.get(key) ?? null };
  }

  isPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getAdmin(): ClarityResponse<string> {
    return { ok: true, value: this.state.contractAdmin };
  }

  getTokenCount(): ClarityResponse<number> {
    return { ok: true, value: this.state.tokenCounter };
  }

  verifyAuthenticity(tokenId: number, providedHash: Uint8Array): boolean {
    const metadata = this.state.tokenMetadata.get(tokenId);
    if (!metadata) return false;
    return arraysEqual(metadata["content-hash"], providedHash);
  }
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Test setup
const accounts = {
  deployer: "deployer",
  user1: "wallet_1",
  user2: "wallet_2",
  collaborator: "wallet_3",
};

const mockHash = new Uint8Array(32).fill(1); // Sample buff 32

describe("TextbookNFT Contract", () => {
  let contract: TextbookNFTMock;

  beforeEach(() => {
    contract = new TextbookNFTMock();
    vi.resetAllMocks();
  });

  it("should allow minting a new textbook NFT", () => {
    const mintResult = contract.mintTextbook(
      accounts.deployer,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      "https://example.com/metadata"
    );
    expect(mintResult).toEqual({ ok: true, value: 1 });

    const owner = contract.getOwner(1);
    expect(owner).toEqual({ ok: true, value: accounts.deployer });

    const metadata = contract.getMetadata(1);
    expect(metadata).toEqual({
      ok: true,
      value: expect.objectContaining({
        title: "Test Title",
        description: "Test Description",
        "initial-price": 100,
        uri: "https://example.com/metadata",
      }),
    });
  });

  it("should prevent minting when paused", () => {
    contract.pause(accounts.deployer);
    const mintResult = contract.mintTextbook(
      accounts.deployer,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    expect(mintResult).toEqual({ ok: false, value: 101 });
  });

  it("should allow transferring NFT", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const transferResult = contract.transfer(
      accounts.user1,
      1,
      accounts.user1,
      accounts.user2
    );
    expect(transferResult).toEqual({ ok: true, value: true });

    const owner = contract.getOwner(1);
    expect(owner).toEqual({ ok: true, value: accounts.user2 });
  });

  it("should prevent non-owner from transferring", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const transferResult = contract.transfer(
      accounts.user2,
      1,
      accounts.user1,
      accounts.user2
    );
    expect(transferResult).toEqual({ ok: false, value: 108 });
  });

  it("should allow burning NFT", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const burnResult = contract.burn(accounts.user1, 1);
    expect(burnResult).toEqual({ ok: true, value: true });

    const owner = contract.getOwner(1);
    expect(owner).toEqual({ ok: true, value: null });
  });

  it("should set royalty", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const setRoyaltyResult = contract.setRoyalty(
      accounts.user1,
      1,
      accounts.user2,
      500 // 5%
    );
    expect(setRoyaltyResult).toEqual({ ok: true, value: true });

    const royalty = contract.getRoyalty(1);
    expect(royalty).toEqual({
      ok: true,
      value: { recipient: accounts.user2, percentage: 500 },
    });
  });

  it("should prevent royalty exceeding max", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const setRoyaltyResult = contract.setRoyalty(
      accounts.user1,
      1,
      accounts.user2,
      1001
    );
    expect(setRoyaltyResult).toEqual({ ok: false, value: 107 });
  });

  it("should register new version", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const newHash = new Uint8Array(32).fill(2);
    const versionResult = contract.registerNewVersion(
      accounts.user1,
      1,
      2,
      newHash,
      "Updated content"
    );
    expect(versionResult).toEqual({ ok: true, value: true });

    const version = contract.getVersion(1, 2);
    expect(version).toEqual({
      ok: true,
      value: expect.objectContaining({
        "update-notes": "Updated content",
      }),
    });
  });

  it("should grant and revoke license", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const grantResult = contract.grantLicense(
      accounts.user1,
      1,
      accounts.user2,
      1000,
      "Standard terms"
    );
    expect(grantResult).toEqual({ ok: true, value: true });

    let license = contract.getLicense(1, accounts.user2);
    expect(license).toEqual({
      ok: true,
      value: expect.objectContaining({ active: true }),
    });

    const revokeResult = contract.revokeLicense(accounts.user1, 1, accounts.user2);
    expect(revokeResult).toEqual({ ok: true, value: true });

    license = contract.getLicense(1, accounts.user2);
    expect(license).toEqual({
      ok: true,
      value: expect.objectContaining({ active: false }),
    });
  });

  it("should add category", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const addCategoryResult = contract.addCategory(
      accounts.user1,
      1,
      "Education",
      ["math", "science"]
    );
    expect(addCategoryResult).toEqual({ ok: true, value: true });

    const category = contract.getCategory(1);
    expect(category).toEqual({
      ok: true,
      value: { category: "Education", tags: ["math", "science"] },
    });
  });

  it("should add collaborator", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const addCollaboratorResult = contract.addCollaborator(
      accounts.user1,
      1,
      accounts.collaborator,
      "Editor",
      ["edit", "review"]
    );
    expect(addCollaboratorResult).toEqual({ ok: true, value: true });

    const collaborator = contract.getCollaborator(1, accounts.collaborator);
    expect(collaborator).toEqual({
      ok: true,
      value: expect.objectContaining({ role: "Editor" }),
    });
  });

  it("should update status", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const updateStatusResult = contract.updateStatus(
      accounts.user1,
      1,
      "archived",
      false
    );
    expect(updateStatusResult).toEqual({ ok: true, value: true });

    const status = contract.getStatus(1);
    expect(status).toEqual({
      ok: true,
      value: expect.objectContaining({ status: "archived", visibility: false }),
    });
  });

  it("should set revenue share", () => {
    contract.mintTextbook(
      accounts.user1,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const setShareResult = contract.setRevenueShare(
      accounts.user1,
      1,
      accounts.user2,
      20
    );
    expect(setShareResult).toEqual({ ok: true, value: true });

    const share = contract.getRevenueShare(1, accounts.user2);
    expect(share).toEqual({
      ok: true,
      value: { percentage: 20, "total-received": 0 },
    });
  });

  it("should pause and unpause contract", () => {
    const pauseResult = contract.pause(accounts.deployer);
    expect(pauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: true });

    const unpauseResult = contract.unpause(accounts.deployer);
    expect(unpauseResult).toEqual({ ok: true, value: true });
    expect(contract.isPaused()).toEqual({ ok: true, value: false });
  });

  it("should verify authenticity", () => {
    contract.mintTextbook(
      accounts.deployer,
      mockHash,
      "Test Title",
      "Test Description",
      100,
      null
    );
    const verifyTrue = contract.verifyAuthenticity(1, mockHash);
    expect(verifyTrue).toBe(true);

    const wrongHash = new Uint8Array(32).fill(2);
    const verifyFalse = contract.verifyAuthenticity(1, wrongHash);
    expect(verifyFalse).toBe(false);
  });
});