// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Cloneable ERC-20 (1B supply, 18 decimals) with built-in QMS dividends.
contract QuantapadToken {
    string public name; string public symbol; string public uri;
    uint8 public constant decimals = 18;
    uint256 public constant SUPPLY = 1_000_000_000 ether;
    uint256 public totalSupply;
    address public portal;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 private constant MAG = 2**128;
    uint256 public magPerShare;
    mapping(address => int256) private corr;
    mapping(address => uint256) public withdrawn;
    uint256 public dividendSupply;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event DividendsDistributed(uint256 amount);
    event DividendClaimed(address indexed holder, uint256 amount);

    function initialize(string calldata n, string calldata s, string calldata u) external {
        require(portal == address(0), "init");
        portal = msg.sender; name = n; symbol = s; uri = u;
        totalSupply = SUPPLY; balanceOf[msg.sender] = SUPPLY;
        emit Transfer(address(0), msg.sender, SUPPLY);
    }
    function approve(address sp, uint256 v) external returns (bool) { allowance[msg.sender][sp] = v; emit Approval(msg.sender, sp, v); return true; }
    function transfer(address to, uint256 v) external returns (bool) { _transfer(msg.sender, to, v); return true; }
    function transferFrom(address f, address to, uint256 v) external returns (bool) {
        uint256 a = allowance[f][msg.sender];
        if (a != type(uint256).max) { require(a >= v, "allowance"); allowance[f][msg.sender] = a - v; }
        _transfer(f, to, v); return true;
    }
    function burn(uint256 v) external { _transfer(msg.sender, address(0), v); }

    function _transfer(address f, address to, uint256 v) internal {
        require(balanceOf[f] >= v, "balance");
        balanceOf[f] -= v;
        if (to == address(0)) totalSupply -= v; else balanceOf[to] += v;
        int256 c = int256(magPerShare * v);
        if (f != portal) { corr[f] += c; dividendSupply -= v; }
        if (to != portal && to != address(0)) { corr[to] -= c; dividendSupply += v; }
        emit Transfer(f, to, v);
    }

    /// @dev Called by the portal with the dividend share of tax. Refunds to portal if nobody holds yet.
    function distribute() external payable {
        if (msg.value == 0) return;
        if (dividendSupply == 0) { (bool ok,) = portal.call{value: msg.value}(""); require(ok, "refund"); return; }
        magPerShare += (msg.value * MAG) / dividendSupply;
        emit DividendsDistributed(msg.value);
    }
    function accumulated(address h) public view returns (uint256) {
        if (h == portal) return 0;
        return uint256(int256(magPerShare * balanceOf[h]) + corr[h]) / MAG;
    }
    function claimable(address h) public view returns (uint256) { return accumulated(h) - withdrawn[h]; }
    function claim() external {
        uint256 amt = claimable(msg.sender); require(amt > 0, "nothing");
        withdrawn[msg.sender] += amt;
        (bool ok,) = msg.sender.call{value: amt}(""); require(ok, "send");
        emit DividendClaimed(msg.sender, amt);
    }
}

/// @notice Factory + bonding-curve market. Liquidity stays in this contract forever.
contract QuantapadPortal {
    struct Split { uint16 creator; uint16 burn; uint16 dividends; uint16 liquidity; }
    struct Market { address creator; uint16 buyTaxBps; uint16 sellTaxBps; Split split; uint256 vQms; uint256 vTok; uint256 reserve; }

    uint16 public constant MAX_TAX_BPS = 1000;
    uint16 public constant PROTOCOL_CUT_PCT = 10;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address public owner; bool public paused; uint256 private lock = 1;
    address public immutable implementation;
    uint256 public virtualQms = 1 ether;
    uint256 public protocolFees;
    mapping(address => Market) public markets;
    mapping(address => uint256) public creatorFees;
    address[] public allTokens;

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol, string uri, uint16 buyTaxBps, uint16 sellTaxBps, Split split);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 qms, uint256 tokens, uint256 tax, uint256 vQms, uint256 vTok);
    event CreatorClaimed(address indexed creator, uint256 amount);
    event Paused(bool paused);

    modifier onlyOwner() { require(msg.sender == owner, "owner"); _; }
    modifier live() { require(!paused, "paused"); _; }
    modifier nonReentrant() { require(lock == 1, "reentrancy"); lock = 2; _; lock = 1; }

    constructor() { owner = msg.sender; implementation = address(new QuantapadToken()); }

    function tokenCount() external view returns (uint256) { return allTokens.length; }

    function createToken(string calldata n, string calldata s, string calldata u, uint16 buyTax, uint16 sellTax, Split calldata sp)
        external payable live nonReentrant returns (address token)
    {
        require(buyTax <= MAX_TAX_BPS && sellTax <= MAX_TAX_BPS, "tax");
        require(uint256(sp.creator) + sp.burn + sp.dividends + sp.liquidity == 100, "split");
        token = _clone(implementation);
        QuantapadToken(token).initialize(n, s, u);
        markets[token] = Market(msg.sender, buyTax, sellTax, sp, virtualQms, 1_000_000_000 ether, 0);
        allTokens.push(token);
        emit TokenCreated(token, msg.sender, n, s, u, buyTax, sellTax, sp);
        if (msg.value > 0) _buy(token, msg.value, 0, msg.sender);
    }

    function quoteBuy(address token, uint256 qmsIn) public view returns (uint256 out, uint256 tax) {
        Market storage m = markets[token];
        tax = qmsIn * m.buyTaxBps / 10_000;
        out = m.vTok - (m.vQms * m.vTok) / (m.vQms + qmsIn - tax);
    }
    function quoteSell(address token, uint256 tokIn) public view returns (uint256 out, uint256 tax) {
        Market storage m = markets[token];
        uint256 gross = m.vQms - (m.vQms * m.vTok) / (m.vTok + tokIn);
        tax = gross * m.sellTaxBps / 10_000;
        out = gross - tax;
    }

    function buy(address token, uint256 minOut) external payable live nonReentrant { _buy(token, msg.value, minOut, msg.sender); }

    function _buy(address token, uint256 qmsIn, uint256 minOut, address to) internal {
        Market storage m = markets[token]; require(m.creator != address(0), "market");
        (uint256 out, uint256 tax) = quoteBuy(token, qmsIn);
        require(out >= minOut && out > 0, "slippage");
        uint256 net = qmsIn - tax;
        m.vQms += net; m.vTok -= out; m.reserve += net;
        QuantapadToken(token).transfer(to, out);
        _distributeTax(token, m, tax);
        emit Trade(token, to, true, qmsIn, out, tax, m.vQms, m.vTok);
    }

    function sell(address token, uint256 tokIn, uint256 minOut) external live nonReentrant {
        Market storage m = markets[token]; require(m.creator != address(0), "market");
        (uint256 out, uint256 tax) = quoteSell(token, tokIn);
        uint256 gross = out + tax;
        require(out >= minOut, "slippage");
        require(m.reserve >= gross, "reserve");
        QuantapadToken(token).transferFrom(msg.sender, address(this), tokIn);
        m.vQms -= gross; m.vTok += tokIn; m.reserve -= gross;
        _distributeTax(token, m, tax);
        (bool ok,) = msg.sender.call{value: out}(""); require(ok, "send");
        emit Trade(token, msg.sender, false, out, tokIn, tax, m.vQms, m.vTok);
    }

    function _distributeTax(address token, Market storage m, uint256 tax) internal {
        if (tax == 0) return;
        uint256 p = tax * PROTOCOL_CUT_PCT / 100; protocolFees += p;
        uint256 rest = tax - p;
        uint256 c = rest * m.split.creator / 100;
        uint256 b = rest * m.split.burn / 100;
        uint256 d = rest * m.split.dividends / 100;
        uint256 l = rest - c - b - d;
        creatorFees[m.creator] += c;
        m.reserve += l;
        if (b > 0) { (bool ok,) = DEAD.call{value: b}(""); require(ok, "burn"); }
        if (d > 0) {
            uint256 before = address(this).balance;
            QuantapadToken(token).distribute{value: d}();
            m.reserve += address(this).balance + d - before; // refunded share becomes liquidity
        }
    }

    function claimCreatorFees() external nonReentrant {
        uint256 a = creatorFees[msg.sender]; require(a > 0, "nothing"); creatorFees[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: a}(""); require(ok, "send"); emit CreatorClaimed(msg.sender, a);
    }
    function withdrawProtocolFees(address to) external onlyOwner nonReentrant {
        uint256 a = protocolFees; protocolFees = 0; (bool ok,) = to.call{value: a}(""); require(ok, "send");
    }
    function setPaused(bool p) external onlyOwner { paused = p; emit Paused(p); }
    function setVirtualQms(uint256 v) external onlyOwner { require(v > 0); virtualQms = v; }
    function transferOwnership(address o) external onlyOwner { require(o != address(0)); owner = o; }

    receive() external payable {}

    function _clone(address impl) internal returns (address inst) {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(ptr, 0x14), shl(0x60, impl))
            mstore(add(ptr, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            inst := create(0, ptr, 0x37)
        }
        require(inst != address(0), "clone");
    }
}
