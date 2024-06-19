// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IRates {
    /// @notice returns the exchange rate, if 0 then it means that there's no rate associated with it, like the case of LV token
    function exchangeRate() external view returns (uint256 rates);
}