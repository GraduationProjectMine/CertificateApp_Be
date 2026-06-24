const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CertificateRegistry", function () {
  const INSTITUTION_NAME = "Dai hoc Blockchain Test";
  const CERT_CODE = "VB-2026-0001";
  const CERT_HASH = ethers.keccak256(ethers.toUtf8Bytes("canonical-metadata"));
  const OTHER_HASH = ethers.keccak256(ethers.toUtf8Bytes("tampered-metadata"));
  const METADATA_CID = "bafybeicertificateproofcid";

  async function deployFixture() {
    const [owner, issuer, publicUser] = await ethers.getSigners();
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    const registry = await CertificateRegistry.deploy(INSTITUTION_NAME);

    return {
      registry,
      owner,
      issuer,
      publicUser,
      ADMIN_ROLE: await registry.ADMIN_ROLE(),
      ISSUER_ROLE: await registry.ISSUER_ROLE(),
    };
  }

  async function issuedFixture() {
    const base = await deployFixture();
    await base.registry.issueCertificate(CERT_CODE, CERT_HASH, METADATA_CID);
    return base;
  }

  describe("Deployment", function () {
    it("sets institution and roles", async function () {
      const { registry, owner, ADMIN_ROLE, ISSUER_ROLE } = await loadFixture(deployFixture);

      expect(await registry.institutionName()).to.equal(INSTITUTION_NAME);
      expect(await registry.hasRole(ADMIN_ROLE, owner.address)).to.equal(true);
      expect(await registry.hasRole(ISSUER_ROLE, owner.address)).to.equal(true);
      expect(await registry.totalCertificates()).to.equal(0);
    });

    it("rejects empty institution name", async function () {
      const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");

      await expect(CertificateRegistry.deploy("")).to.be.revertedWith(
        "Institution name cannot be empty"
      );
    });
  });

  describe("Issue", function () {
    it("stores only certificate proof fields", async function () {
      const { registry, owner } = await loadFixture(deployFixture);

      await expect(registry.issueCertificate(CERT_CODE, CERT_HASH, METADATA_CID))
        .to.emit(registry, "CertificateIssued")
        .withArgs(CERT_CODE, CERT_HASH, METADATA_CID, owner.address, (value) => value > 0n);

      const proof = await registry.getCertificateProof(CERT_CODE);
      expect(proof.certificateHash).to.equal(CERT_HASH);
      expect(proof.metadataCID).to.equal(METADATA_CID);
      expect(proof.issuer).to.equal(owner.address);
      expect(proof.revokedAt).to.equal(0);
      expect(proof.exists).to.equal(true);
      expect(await registry.totalCertificates()).to.equal(1);
    });

    it("rejects duplicate, empty CID, and zero hash", async function () {
      const { registry } = await loadFixture(issuedFixture);

      await expect(
        registry.issueCertificate(CERT_CODE, CERT_HASH, "bafyother")
      ).to.be.revertedWithCustomError(registry, "CertificateAlreadyExists");

      await expect(
        registry.issueCertificate("VB-2026-0002", CERT_HASH, "")
      ).to.be.revertedWithCustomError(registry, "EmptyField");

      await expect(
        registry.issueCertificate("VB-2026-0003", ethers.ZeroHash, METADATA_CID)
      ).to.be.revertedWithCustomError(registry, "EmptyField");
    });

    it("requires ISSUER_ROLE", async function () {
      const { registry, publicUser } = await loadFixture(deployFixture);

      await expect(
        registry.connect(publicUser).issueCertificate(CERT_CODE, CERT_HASH, METADATA_CID)
      ).to.be.reverted;
    });
  });

  describe("Verify", function () {
    it("verifies matching hash only", async function () {
      const { registry } = await loadFixture(issuedFixture);

      expect(await registry.verifyCertificate(CERT_CODE, CERT_HASH)).to.equal(true);
      expect(await registry.verifyCertificate(CERT_CODE, OTHER_HASH)).to.equal(false);
      expect(await registry.verifyCertificate("VB-NOT-FOUND", CERT_HASH)).to.equal(false);
    });

    it("reverts get proof for missing certificate", async function () {
      const { registry } = await loadFixture(deployFixture);

      await expect(
        registry.getCertificateProof("VB-NOT-FOUND")
      ).to.be.revertedWithCustomError(registry, "CertificateNotFound");
    });
  });

  describe("Revoke", function () {
    it("allows issuer or admin to revoke", async function () {
      const { registry, owner } = await loadFixture(issuedFixture);

      await expect(registry.revokeCertificate(CERT_CODE, "Sai thong tin"))
        .to.emit(registry, "CertificateRevoked")
        .withArgs(CERT_CODE, owner.address, (value) => value > 0n, "Sai thong tin");

      const proof = await registry.getCertificateProof(CERT_CODE);
      expect(proof.revokedAt).to.be.greaterThan(0);
      expect(await registry.verifyCertificate(CERT_CODE, CERT_HASH)).to.equal(false);
      expect(await registry.totalRevoked()).to.equal(1);
    });

    it("rejects double revoke and unauthorized revoke", async function () {
      const { registry, publicUser } = await loadFixture(issuedFixture);

      await expect(
        registry.connect(publicUser).revokeCertificate(CERT_CODE, "Hack")
      ).to.be.revertedWithCustomError(registry, "NotCertificateIssuerOrAdmin");

      await registry.revokeCertificate(CERT_CODE, "Lan 1");

      await expect(
        registry.revokeCertificate(CERT_CODE, "Lan 2")
      ).to.be.revertedWithCustomError(registry, "CertificateAlreadyRevoked");
    });
  });

  describe("Admin", function () {
    it("manages issuers and institution name", async function () {
      const { registry, issuer, ISSUER_ROLE } = await loadFixture(deployFixture);

      await registry.addIssuer(issuer.address);
      expect(await registry.hasRole(ISSUER_ROLE, issuer.address)).to.equal(true);

      await registry.connect(issuer).issueCertificate("VB-2026-0002", OTHER_HASH, "bafyissuer");

      await registry.removeIssuer(issuer.address);
      expect(await registry.hasRole(ISSUER_ROLE, issuer.address)).to.equal(false);

      await expect(registry.updateInstitutionName("Dai hoc Moi"))
        .to.emit(registry, "InstitutionNameUpdated")
        .withArgs(INSTITUTION_NAME, "Dai hoc Moi");
    });

    it("pauses issuing", async function () {
      const { registry } = await loadFixture(deployFixture);

      await registry.pause();

      await expect(
        registry.issueCertificate(CERT_CODE, CERT_HASH, METADATA_CID)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      await registry.unpause();
      await expect(registry.issueCertificate(CERT_CODE, CERT_HASH, METADATA_CID)).to.not.be
        .reverted;
    });
  });

  describe("Stats", function () {
    it("returns total, revoked, active", async function () {
      const { registry } = await loadFixture(issuedFixture);

      await registry.issueCertificate("VB-2026-0002", OTHER_HASH, "bafy2");
      await registry.revokeCertificate(CERT_CODE, "Test");

      const stats = await registry.getStats();
      expect(stats.total).to.equal(2);
      expect(stats.revoked).to.equal(1);
      expect(stats.active).to.equal(1);
    });
  });
});
