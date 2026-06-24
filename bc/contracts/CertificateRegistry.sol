// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CertificateRegistry
 * @notice Luu bang chung xac thuc van bang tren blockchain.
 * @dev Contract chi luu proof bat bien: hash, metadata CID, issuer va trang thai thu hoi.
 *      Thong tin ca nhan/file day du nam off-chain trong DB va IPFS.
 */
contract CertificateRegistry is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct CertificateProof {
        bytes32 certificateHash;
        string metadataCID;
        address issuer;
        uint256 issuedAt;
        uint256 revokedAt;
        bool exists;
    }

    mapping(string => CertificateProof) private certificates;

    uint256 public totalCertificates;
    uint256 public totalRevoked;
    string public institutionName;
    address public contractOwner;

    event CertificateIssued(
        string indexed certificateCode,
        bytes32 certificateHash,
        string metadataCID,
        address indexed issuer,
        uint256 issuedAt
    );

    event CertificateRevoked(
        string indexed certificateCode,
        address indexed revokedBy,
        uint256 revokedAt,
        string reason
    );

    event InstitutionNameUpdated(string oldName, string newName);

    error CertificateAlreadyExists(string certificateCode);
    error CertificateNotFound(string certificateCode);
    error CertificateAlreadyRevoked(string certificateCode);
    error EmptyField(string fieldName);
    error InvalidAddress();
    error NotCertificateIssuerOrAdmin();

    constructor(string memory _institutionName) {
        require(bytes(_institutionName).length > 0, "Institution name cannot be empty");

        institutionName = _institutionName;
        contractOwner = msg.sender;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    modifier certificateMustExist(string memory certificateCode) {
        if (!certificates[certificateCode].exists) {
            revert CertificateNotFound(certificateCode);
        }
        _;
    }

    modifier certificateMustNotExist(string memory certificateCode) {
        if (certificates[certificateCode].exists) {
            revert CertificateAlreadyExists(certificateCode);
        }
        _;
    }

    modifier notEmpty(string memory value, string memory fieldName) {
        if (bytes(value).length == 0) {
            revert EmptyField(fieldName);
        }
        _;
    }

    function issueCertificate(
        string calldata certificateCode,
        bytes32 certificateHash,
        string calldata metadataCID
    )
        external
        onlyRole(ISSUER_ROLE)
        whenNotPaused
        nonReentrant
        certificateMustNotExist(certificateCode)
        notEmpty(certificateCode, "certificateCode")
        notEmpty(metadataCID, "metadataCID")
    {
        if (certificateHash == bytes32(0)) {
            revert EmptyField("certificateHash");
        }

        certificates[certificateCode] = CertificateProof({
            certificateHash: certificateHash,
            metadataCID: metadataCID,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            revokedAt: 0,
            exists: true
        });

        totalCertificates++;

        emit CertificateIssued(
            certificateCode,
            certificateHash,
            metadataCID,
            msg.sender,
            block.timestamp
        );
    }

    function revokeCertificate(
        string calldata certificateCode,
        string calldata reason
    )
        external
        whenNotPaused
        nonReentrant
        certificateMustExist(certificateCode)
    {
        CertificateProof storage proof = certificates[certificateCode];

        if (proof.revokedAt != 0) {
            revert CertificateAlreadyRevoked(certificateCode);
        }

        if (proof.issuer != msg.sender && !hasRole(ADMIN_ROLE, msg.sender)) {
            revert NotCertificateIssuerOrAdmin();
        }

        proof.revokedAt = block.timestamp;
        totalRevoked++;

        emit CertificateRevoked(
            certificateCode,
            msg.sender,
            block.timestamp,
            reason
        );
    }

    function getCertificateProof(string calldata certificateCode)
        external
        view
        certificateMustExist(certificateCode)
        returns (CertificateProof memory)
    {
        return certificates[certificateCode];
    }

    function verifyCertificate(
        string calldata certificateCode,
        bytes32 expectedHash
    ) external view returns (bool) {
        CertificateProof memory proof = certificates[certificateCode];
        return (
            proof.exists &&
            proof.revokedAt == 0 &&
            proof.certificateHash == expectedHash
        );
    }

    function isCertificateExists(string calldata certificateCode)
        external
        view
        returns (bool)
    {
        return certificates[certificateCode].exists;
    }

    function getStats()
        external
        view
        returns (
            uint256 total,
            uint256 revoked,
            uint256 active
        )
    {
        return (
            totalCertificates,
            totalRevoked,
            totalCertificates - totalRevoked
        );
    }

    function addIssuer(address issuer) external onlyRole(ADMIN_ROLE) {
        if (issuer == address(0)) revert InvalidAddress();
        _grantRole(ISSUER_ROLE, issuer);
    }

    function removeIssuer(address issuer) external onlyRole(ADMIN_ROLE) {
        if (issuer == address(0)) revert InvalidAddress();
        _revokeRole(ISSUER_ROLE, issuer);
    }

    function updateInstitutionName(string calldata newName)
        external
        onlyRole(ADMIN_ROLE)
        notEmpty(newName, "institutionName")
    {
        string memory oldName = institutionName;
        institutionName = newName;
        emit InstitutionNameUpdated(oldName, newName);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
