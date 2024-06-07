// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./interfaces/IAssetFactory.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./WrappedAsset.sol";
import "./Lv.sol";
import "./Asset.sol";
import "./libraries/FactoryFetcher.sol";

struct WrappedAssets {
    address ra;
    address wa;
}

struct SwapAssets {
    address ct;
    address ds;
}

// TODO : add LV asset
contract AssetFactory is IAssetFactory, OwnableUpgradeable, UUPSUpgradeable {
    uint8 public constant MAX_LIMIT = 10;
    string private constant CT_PREFIX = "CT";
    string private constant DS_PREFIX = "DS";

    uint256 idx;

    mapping(uint256 => address) lvs;
    mapping(uint256 => WrappedAssets) wrappedAssets;
    mapping(address => SwapAssets[]) swapAssets;
    mapping(address => bool) deployed;

    // for safety checks in psm core, also act as kind of like a registry
    function isDeployed(address asset) external view override returns (bool) {
        return deployed[asset];
    }

    modifier withinLimit(uint8 limit) {
        if (limit > MAX_LIMIT) {
            revert LimitTooLong(MAX_LIMIT, limit);
        }
        _;
    }

    constructor() {}

    function initialize() external initializer notDelegated {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function getDeployedWrappedAssets(
        uint8 page,
        uint8 limit
    )
        external
        view
        override
        withinLimit(limit)
        returns (address[] memory ra, address[] memory wa)
    {
        (ra, wa) = Fetcher.getDeployedWrappedAssets(
            page,
            limit,
            idx,
            wrappedAssets
        );
    }

    function getDeployedSwapAssets(
        address wa,
        uint8 page,
        uint8 limit
    )
        external
        view
        override
        withinLimit(limit)
        returns (address[] memory ct, address[] memory ds)
    {
        SwapAssets[] storage assets = swapAssets[wa];

        uint256 start = uint256(page) * uint256(limit);
        uint256 end = start + uint256(limit);
        uint256 arrLen = end - start;

        if (end > assets.length) {
            end = assets.length;
        }

        ct = new address[](arrLen);
        ds = new address[](arrLen);

        for (uint256 i = start; i < end; i++) {
            ct[i - start] = assets[i].ct;
            ds[i - start] = assets[i].ds;
        }
    }

    function deploySwapAssets(
        address ra,
        address pa,
        address wa,
        address owner,
        uint256 expiry
    )
        external
        override
        onlyOwner
        notDelegated
        returns (address ct, address ds)
    {
        string memory pairname = string(
            abi.encodePacked(Asset(ra).name(), "-", Asset(pa).name())
        );

        ct = address(new Asset(CT_PREFIX, pairname, owner, expiry));
        ds = address(new Asset(DS_PREFIX, pairname, owner, expiry));

        // TODO : tests this with ~100 pairs
        swapAssets[wa].push(SwapAssets(ct, ds));

        deployed[ct] = true;
        deployed[ds] = true;

        emit AssetDeployed(wa, ct, ds);
    }

    // TODO : owner will be config contract later
    function deployWrappedAsset(
        address ra,
        address pa,
        address owner
    )
        external
        override
        onlyOwner
        notDelegated
        returns (address wa, address lv)
    {
        uint256 _idx = idx++;

        lv = address(new Lv(ra, pa, owner));
        wa = address(new WrappedAsset(ra));

        wrappedAssets[_idx] = WrappedAssets(ra, wa);
        lvs[_idx] = lv;

        deployed[wa] = true;
        deployed[lv] = true;

        emit WrappedAssetDeployed(ra, wa, lv);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner notDelegated {}
}
