// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGenArtInterface {
    function getMaxMintForMembership(uint256 _membershipId)
        external
        view
        returns (uint256);

    function getMaxMintForOwner(address owner) external view returns (uint256);

    function upgradeGenArtTokenContract(address _genArtTokenAddress) external;

    function setAllowGen(bool allow) external;

    function genAllowed() external view returns (bool);

    function isGoldToken(uint256 _membershipId) external view returns (bool);

    function transferFrom(
        address _from,
        address _to,
        uint256 _amount
    ) external;

    function updateNonce() external;

    function getRandomChoise(uint256[] memory choises)
        external
        view
        returns (uint256);

    function balanceOf(address _owner) external view returns (uint256);

    function ownerOf(uint256 _membershipId) external view returns (address);
}
