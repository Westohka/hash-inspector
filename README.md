# Hash inspector

It`s only example of architecture for blockchain hash inspectors code.
The inspector implies that any blockchain hash is fed into the input and transaction details are fed into the output. Since networks can be unique among themselves, a proxy class for networks with their own implementation and dependencies is implied. Since smart contract networks can contain different types of transactions when integrating with smart contracts there is an abstract inspector class for which the parse method needs to be overridden depending on the necessary conditions and behavior.
